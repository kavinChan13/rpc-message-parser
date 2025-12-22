"""
Log Parser Service - Parse O-RAN RPC logs and extract data
"""

import re
import xmltodict
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from .database import LogFile, RPCMessage, ErrorMessage, CarrierEvent
import json


class LogParserService:
    """Log parsing service"""

    # Log line regex pattern
    LOG_LINE_PATTERN = re.compile(
        r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+'  # Timestamp
        r'(\w+):\s+'  # Log level
        r'\[([^\]]+)\]\s+'  # Host address
        r'Session\s+(\d+):\s+'  # SessionID
        r'(.+)$'  # Message content
    )

    # Message direction regex
    MESSAGE_DIRECTION_PATTERN = re.compile(
        r'(Sending|Received)\s+message:(.+)',
        re.DOTALL
    )

    # YANG Module namespace mapping
    YANG_MODULES = {
        'urn:ietf:params:xml:ns:netconf:base:1.0': 'ietf-netconf',
        'urn:o-ran:supervision:1.0': 'o-ran-supervision',
        'urn:o-ran:fm:1.0': 'o-ran-fm',
        'urn:o-ran:operations:1.0': 'o-ran-operations',
        'urn:o-ran:performance-management:1.0': 'o-ran-performance-management',
        'urn:o-ran:transceiver:1.0': 'o-ran-transceiver',
        'urn:o-ran:hardware:1.0': 'o-ran-hardware',
        'urn:o-ran:software-management:1.0': 'o-ran-software-management',
        'urn:o-ran:file-management:1.0': 'o-ran-file-management',
        'urn:o-ran:uplane-conf:1.0': 'o-ran-uplane-conf',
        'urn:o-ran:delay:1.0': 'o-ran-delay-management',
        'urn:o-ran:troubleshooting:1.0': 'o-ran-troubleshooting',
        'urn:nokia.com:ran:ru:operations:1.0': 'nokia-ran-ru-operations',
        'urn:nokia.com:ran:ru:transceiver:1.0': 'nokia-ran-ru-transceiver',
        'urn:nokia.com:ran:ru:performance-management:1.0': 'nokia-ran-ru-pm',
        'urn:nokia.com:ran:ru:fcp-triggered-captures:1.0': 'nokia-ran-ru-fcp',
    }

    # Carrier Related element names
    CARRIER_ELEMENTS = {
        'rx-array-carriers': 'RX Array Carrier',
        'tx-array-carriers': 'TX Array Carrier',
        'low-level-rx-links': 'Low-Level RX Link',
        'low-level-tx-links': 'Low-Level TX Link',
        'low-level-rx-endpoints': 'Low-Level RX Endpoint',
        'low-level-tx-endpoints': 'Low-Level TX Endpoint',
        'static-low-level-rx-endpoints': 'Static Low-Level RX Endpoint',
        'static-low-level-tx-endpoints': 'Static Low-Level TX Endpoint',
    }

    def __init__(self, db: AsyncSession, log_file: LogFile):
        self.db = db
        self.log_file = log_file
        self.rpc_messages: List[RPCMessage] = []
        self.error_messages: List[ErrorMessage] = []
        self.carrier_events: List[CarrierEvent] = []
        self.pending_requests: Dict[str, RPCMessage] = {}  # message_id -> request

    async def parse(self) -> Tuple[int, int, int]:
        """
        Parse log file with support for multi-line messages

        Returns:
            (total_lines, total_messages, error_count)
        """
        file_path = Path(self.log_file.file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        total_lines = 0
        total_messages = 0
        error_count = 0

        # Buffer for accumulating multi-line messages
        pending_message = None
        pending_start_line = None

        with open(file_path, 'r', encoding='utf-8') as f:
            lines = [(i, line.strip()) for i, line in enumerate(f, 1) if line.strip()]

            i = 0
            while i < len(lines):
                line_number, line = lines[i]
                total_lines += 1

                # Try to parse this line
                parsed = self._parse_line_with_merge(
                    line,
                    line_number,
                    pending_message,
                    pending_start_line
                )

                if parsed is None:
                    # Not a valid log line, skip
                    pending_message = None
                    pending_start_line = None
                    i += 1
                    continue

                status, message_data, xml_buffer, start_line = parsed

                if status == 'complete':
                    # Message is complete, process it
                    result = self._process_complete_message(message_data, start_line)
                    if result:
                        total_messages += 1
                        if result.get('is_error'):
                            error_count += 1
                    pending_message = None
                    pending_start_line = None
                    i += 1
                elif status == 'incomplete':
                    # Message is incomplete, save buffer for next line
                    pending_message = xml_buffer
                    pending_start_line = start_line
                    i += 1
                elif status == 'flush_pending':
                    # Need to flush pending message first, then reprocess this line
                    if pending_message:
                        # Process pending message even though it's incomplete
                        message_data = self._extract_message_data(pending_message['line'], pending_start_line)
                        if message_data:
                            message_data['xml_content'] = pending_message['xml_accumulated']
                            result = self._process_complete_message(message_data, pending_start_line)
                            if result:
                                total_messages += 1
                                if result.get('is_error'):
                                    error_count += 1

                    # Clear pending and reprocess current line
                    pending_message = None
                    pending_start_line = None
                    # Don't increment i - reprocess this line
                else:
                    # Unknown status
                    i += 1

        # Process any remaining pending message (treat as complete even if incomplete)
        if pending_message:
            message_data = self._extract_message_data(pending_message['line'], pending_start_line)
            if message_data:
                message_data['xml_content'] = pending_message['xml_accumulated']
                result = self._process_complete_message(message_data, pending_start_line)
                if result:
                    total_messages += 1
                    if result.get('is_error'):
                        error_count += 1

        # Save all messages to database
        if self.rpc_messages:
            self.db.add_all(self.rpc_messages)
        if self.error_messages:
            self.db.add_all(self.error_messages)
        if self.carrier_events:
            self.db.add_all(self.carrier_events)

        await self.db.commit()

        return total_lines, total_messages, error_count

    def _parse_line_with_merge(self, line: str, line_number: int,
                               pending_message: Optional[Dict],
                               pending_start_line: Optional[int]) -> Optional[tuple]:
        """
        Parse a line with support for multi-line message merging

        Returns:
            None if line doesn't match log pattern
            ('complete', message_data, None, start_line) if message is complete
            ('incomplete', None, xml_buffer, start_line) if message needs more lines
        """
        match = self.LOG_LINE_PATTERN.match(line)
        if not match:
            return None

        timestamp_str, level, host, session_id_str, message = match.groups()

        # Check for message direction and XML
        dir_match = self.MESSAGE_DIRECTION_PATTERN.match(message)
        if not dir_match:
            return None

        direction_str, xml_content = dir_match.groups()
        xml_content = xml_content.strip()

        # If we have a pending message, try to merge
        if pending_message:
            # Same session and direction? Merge XML content
            if (pending_message.get('session_id') == int(session_id_str) and
                pending_message.get('direction_str') == direction_str):
                # Accumulate XML (add space to preserve XML structure between lines)
                accumulated_xml = pending_message['xml_accumulated'] + ' ' + xml_content

                # Check if XML is now complete
                if self._is_xml_complete(accumulated_xml):
                    # Message is complete
                    message_data = self._extract_message_data(pending_message['line'], pending_start_line)
                    if message_data:
                        message_data['xml_content'] = accumulated_xml
                        return ('complete', message_data, None, pending_start_line)
                else:
                    # Still incomplete, update buffer
                    pending_message['xml_accumulated'] = accumulated_xml
                    return ('incomplete', None, pending_message, pending_start_line)
            else:
                # Different session or direction - this is a NEW message
                # First, we need to flush the pending message (even if incomplete)
                # Return a signal to process pending first, then re-process this line
                return ('flush_pending', None, None, pending_start_line)

        # This is a new message (not a continuation)
        # Check if XML is complete
        if self._is_xml_complete(xml_content):
            # Complete message
            message_data = self._extract_message_data(line, line_number)
            if message_data:
                message_data['xml_content'] = xml_content
                return ('complete', message_data, None, line_number)
        else:
            # Incomplete message, save buffer
            xml_buffer = {
                'line': line,
                'session_id': int(session_id_str),
                'direction_str': direction_str,
                'xml_accumulated': xml_content
            }
            return ('incomplete', None, xml_buffer, line_number)

        return None

    def _is_xml_complete(self, xml_content: str) -> bool:
        """
        Check if XML content is complete (has matching opening and closing tags)
        """
        try:
            # Try to parse XML - if it works, it's complete
            xmltodict.parse(xml_content)
            return True
        except Exception:
            # Parse failed - XML is incomplete
            return False

    def _extract_message_data(self, line: str, line_number: int) -> Optional[Dict[str, Any]]:
        """
        Extract message metadata (timestamp, session, direction, etc.) from log line
        """
        match = self.LOG_LINE_PATTERN.match(line)
        if not match:
            return None

        timestamp_str, level, host, session_id_str, message = match.groups()

        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except ValueError:
            timestamp = None

        session_id = int(session_id_str)

        # Check for message direction
        dir_match = self.MESSAGE_DIRECTION_PATTERN.match(message)
        if not dir_match:
            return None

        direction_str, _ = dir_match.groups()

        # Determine direction: Sending = DU->RU, Received = RU->DU
        direction = "DU->RU" if direction_str == "Sending" else "RU->DU"

        return {
            'line_number': line_number,
            'timestamp': timestamp,
            'session_id': session_id,
            'host': host,
            'direction': direction,
            'is_error': False
        }

    def _process_complete_message(self, message_data: Dict[str, Any],
                                   start_line: int) -> Optional[Dict[str, Any]]:
        """
        Process a complete message (with full XML content)
        """
        xml_content = message_data.get('xml_content', '')

        # Parse XML
        try:
            xml_dict = xmltodict.parse(xml_content)
            root_element = list(xml_dict.keys())[0] if xml_dict else None
        except Exception as e:
            # XML parse failed - skip this message
            return None

        # Update line number to start line
        message_data['line_number'] = start_line

        # Process based on message type
        if root_element == 'rpc':
            self._process_rpc(message_data, xml_dict)
        elif root_element == 'rpc-reply':
            self._process_rpc_reply(message_data, xml_dict)
        elif root_element == 'notification':
            self._process_notification(message_data, xml_dict)
        else:
            return None

        return message_data

    def _parse_line(self, line: str, line_number: int) -> Optional[Dict[str, Any]]:
        """Parse single log line"""
        match = self.LOG_LINE_PATTERN.match(line)
        if not match:
            return None

        timestamp_str, level, host, session_id_str, message = match.groups()

        # Parse timestamp
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except ValueError:
            timestamp = None

        session_id = int(session_id_str)

        # Check for message direction and XML
        dir_match = self.MESSAGE_DIRECTION_PATTERN.match(message)
        if not dir_match:
            return None

        direction_str, xml_content = dir_match.groups()
        xml_content = xml_content.strip()

        # Determine direction: Sending = DU->RU, Received = RU->DU
        direction = "DU->RU" if direction_str == "Sending" else "RU->DU"

        # Parse XML
        try:
            xml_dict = xmltodict.parse(xml_content)
            root_element = list(xml_dict.keys())[0] if xml_dict else None
        except Exception:
            return None

        result = {
            'line_number': line_number,
            'timestamp': timestamp,
            'session_id': session_id,
            'host': host,
            'direction': direction,
            'xml_content': xml_content,
            'is_error': False
        }

        # Process based on message type
        if root_element == 'rpc':
            self._process_rpc(result, xml_dict)
        elif root_element == 'rpc-reply':
            self._process_rpc_reply(result, xml_dict)
        elif root_element == 'notification':
            self._process_notification(result, xml_dict)
        else:
            return None

        return result

    def _extract_yang_modules_from_element(self, element: Any, depth: int = 0) -> List[str]:
        """
        Recursively extract all YANG module namespaces
        Return all found specific YANG module list
        """
        modules = []
        if not isinstance(element, dict) or depth > 10:
            return modules

        for key, value in element.items():
            if key == '@xmlns':
                # Direct namespace declaration
                ns = value
                if ns and ns not in ['urn:ietf:params:xml:ns:netconf:base:1.0']:
                    module = self.YANG_MODULES.get(ns, ns)
                    if module:
                        modules.append(module)
            elif key.startswith('@xmlns:'):
                # Prefix namespace declaration
                ns = value
                if ns and ns not in ['urn:ietf:params:xml:ns:netconf:base:1.0']:
                    module = self.YANG_MODULES.get(ns, ns)
                    if module:
                        modules.append(module)
            elif not key.startswith('@'):
                # Recursively process child elements
                if isinstance(value, dict):
                    modules.extend(self._extract_yang_modules_from_element(value, depth + 1))
                elif isinstance(value, list):
                    for item in value:
                        modules.extend(self._extract_yang_modules_from_element(item, depth + 1))

        return modules

    def _get_specific_yang_modules(self, operation: str, op_value: Any) -> Optional[str]:
        """
        Get more specific based on operation type YANG module
        For get/get-config/edit-config etc operations, deep dive into filter/config internal search
        """
        if not isinstance(op_value, dict):
            return None

        # First check operation's own namespace
        direct_ns = op_value.get('@xmlns', '')
        if direct_ns and direct_ns not in ['urn:ietf:params:xml:ns:netconf:base:1.0']:
            direct_module = self.YANG_MODULES.get(direct_ns, direct_ns)
            if direct_module:
                return direct_module

        # For specific operations, deep dive to find specific YANG modules
        target_elements = []

        if operation == 'get':
            # get operation search inside filter
            filter_elem = op_value.get('filter', {})
            if isinstance(filter_elem, dict):
                target_elements.append(filter_elem)
        elif operation == 'get-config':
            # get-config operation search inside filter
            filter_elem = op_value.get('filter', {})
            if isinstance(filter_elem, dict):
                target_elements.append(filter_elem)
        elif operation == 'edit-config':
            # edit-config operation search inside config
            config_elem = op_value.get('config', {})
            if isinstance(config_elem, dict):
                target_elements.append(config_elem)
        elif operation == 'action':
            # action operation direct search
            target_elements.append(op_value)
        else:
            # For other operations, search directly
            target_elements.append(op_value)

        # Extract all from target element YANG module
        all_modules = []
        for elem in target_elements:
            all_modules.extend(self._extract_yang_modules_from_element(elem))

        # Deduplicate and filter out basic netconf module
        unique_modules = []
        seen = set()
        for m in all_modules:
            if m not in seen and m != 'ietf-netconf':
                seen.add(m)
                unique_modules.append(m)

        if unique_modules:
            # Return all found specific modules, comma-separated
            return ', '.join(unique_modules[:3])  # Show maximum 3 modules

        return None

    def _process_rpc(self, result: Dict[str, Any], xml_dict: Dict):
        """Process RPC Request"""
        rpc = xml_dict.get('rpc', {})
        message_id = rpc.get('@message-id')

        # Find operation and namespace
        operation = None
        yang_module = None

        for key, value in rpc.items():
            if not key.startswith('@'):
                operation = key
                if isinstance(value, dict):
                    # Try to get more specific YANG module
                    yang_module = self._get_specific_yang_modules(key, value)
                    # If no specific module found, fallback to direct namespace
                    if not yang_module:
                        ns = value.get('@xmlns', '')
                        yang_module = self.YANG_MODULES.get(ns, ns) if ns else None
                break

        rpc_msg = RPCMessage(
            log_file_id=self.log_file.id,
            line_number=result['line_number'],
            timestamp=result['timestamp'],
            session_id=result['session_id'],
            host=result['host'],
            message_id=message_id,
            message_type='rpc',
            direction=result['direction'],
            operation=operation,
            yang_module=yang_module,
            xml_content=result['xml_content']
        )

        self.rpc_messages.append(rpc_msg)

        # Extract carrier-related events
        result['message_type'] = 'rpc'
        self._extract_carrier_events(result, xml_dict, operation or 'unknown', rpc_msg)

        # Store for matching response
        if message_id:
            self.pending_requests[f"{result['session_id']}:{message_id}"] = rpc_msg

    def _process_rpc_reply(self, result: Dict[str, Any], xml_dict: Dict):
        """Process RPC Response"""
        reply = xml_dict.get('rpc-reply', {})
        message_id = reply.get('@message-id')

        # Check for errors
        has_error = 'rpc-error' in reply
        error_info = None

        if has_error:
            result['is_error'] = True
            error = reply.get('rpc-error', {})
            error_info = {
                'error_type': error.get('error-type'),
                'error_tag': error.get('error-tag'),
                'error_severity': error.get('error-severity'),
                'error_message': self._extract_error_message(error)
            }

            # Create error message record
            err_msg = ErrorMessage(
                log_file_id=self.log_file.id,
                line_number=result['line_number'],
                timestamp=result['timestamp'],
                session_id=result['session_id'],
                error_type='rpc-error',
                error_tag=error_info['error_tag'],
                error_severity=error_info['error_severity'],
                error_message=error_info['error_message'],
                xml_content=result['xml_content']
            )
            self.error_messages.append(err_msg)

        # Find operation from response content
        operation = None
        yang_module = None

        for key, value in reply.items():
            if key not in ['@message-id', '@xmlns', 'ok', 'rpc-error']:
                if key == 'data':
                    # data element contains specific YANG modules
                    operation = 'data'
                    if isinstance(value, dict):
                        modules = self._extract_yang_modules_from_element(value)
                        unique_modules = []
                        seen = set()
                        for m in modules:
                            if m not in seen and m != 'ietf-netconf':
                                seen.add(m)
                                unique_modules.append(m)
                        if unique_modules:
                            yang_module = ', '.join(unique_modules[:3])
                else:
                    operation = key
                    if isinstance(value, dict):
                        # Try to get more specific YANG module
                        yang_module = self._get_specific_yang_modules(key, value)
                        if not yang_module:
                            ns = value.get('@xmlns', '')
                            yang_module = self.YANG_MODULES.get(ns, ns) if ns else None
                break

        rpc_msg = RPCMessage(
            log_file_id=self.log_file.id,
            line_number=result['line_number'],
            timestamp=result['timestamp'],
            session_id=result['session_id'],
            host=result['host'],
            message_id=message_id,
            message_type='rpc-reply',
            direction=result['direction'],
            operation=operation,
            yang_module=yang_module,
            xml_content=result['xml_content']
        )

        self.rpc_messages.append(rpc_msg)

        # Extract carrier-related events
        result['message_type'] = 'rpc-reply'
        self._extract_carrier_events(result, xml_dict, operation or 'reply', rpc_msg)

        # Match with request and calculate response time
        if message_id:
            key = f"{result['session_id']}:{message_id}"
            if key in self.pending_requests:
                request = self.pending_requests[key]
                if request.timestamp and result['timestamp']:
                    delta = result['timestamp'] - request.timestamp
                    response_time_ms = delta.total_seconds() * 1000
                    request.response_time_ms = response_time_ms
                    request.has_response = True
                    rpc_msg.response_time_ms = response_time_ms
                del self.pending_requests[key]

    def _process_notification(self, result: Dict[str, Any], xml_dict: Dict):
        """Process notification messages"""
        notif = xml_dict.get('notification', {})

        # Find notification type and namespace
        notif_type = None
        yang_module = None

        for key, value in notif.items():
            if key not in ['@xmlns', 'eventTime']:
                notif_type = key
                if isinstance(value, dict):
                    # Try to get more specific YANG module
                    yang_module = self._get_specific_yang_modules(key, value)
                    if not yang_module:
                        ns = value.get('@xmlns', '')
                        yang_module = self.YANG_MODULES.get(ns, ns) if ns else None
                break

        rpc_msg = RPCMessage(
            log_file_id=self.log_file.id,
            line_number=result['line_number'],
            timestamp=result['timestamp'],
            session_id=result['session_id'],
            host=result['host'],
            message_type='notification',
            direction=result['direction'],
            operation=notif_type,
            yang_module=yang_module,
            xml_content=result['xml_content']
        )

        self.rpc_messages.append(rpc_msg)

        # Extract carrier-related events (state change notifications, etc.)
        result['message_type'] = 'notification'
        self._extract_carrier_events(result, xml_dict, notif_type or 'notification', rpc_msg)

        # Check for alarm/fault notifications
        if notif_type == 'alarm-notif':
            result['is_error'] = True
            self._process_alarm_notification(result, notif.get('alarm-notif', {}))

    def _process_alarm_notification(self, result: Dict[str, Any], alarm: Dict):
        """Process alarm notifications"""
        err_msg = ErrorMessage(
            log_file_id=self.log_file.id,
            line_number=result['line_number'],
            timestamp=result['timestamp'],
            session_id=result['session_id'],
            error_type='fault',
            error_tag=alarm.get('fault-severity'),
            error_severity=alarm.get('fault-severity'),
            error_message=alarm.get('fault-text'),
            fault_id=alarm.get('fault-id'),
            fault_source=alarm.get('fault-source'),
            is_cleared=str(alarm.get('is-cleared', 'false')).lower() == 'true',
            xml_content=result['xml_content']
        )
        self.error_messages.append(err_msg)

    def _extract_error_message(self, error: Dict) -> Optional[str]:
        """Extract error message"""
        msg = error.get('error-message')
        if isinstance(msg, dict):
            return msg.get('#text', str(msg))
        return msg

    def _extract_carrier_events(self, result: Dict[str, Any], xml_dict: Dict,
                                 operation: str, rpc_msg: RPCMessage = None):
        """
        Extract carrier-related events from XML content
        Detect array-carriers, low-level-links, low-level-endpoints, etc.
        """
        # Determine what to search based on message type
        content_to_search = None
        event_type = None

        root_element = list(xml_dict.keys())[0] if xml_dict else None

        if root_element == 'rpc':
            rpc = xml_dict.get('rpc', {})
            if 'edit-config' in rpc:
                edit_config = rpc.get('edit-config', {})
                config = edit_config.get('config', {})
                content_to_search = config
                # edit-config can be create, update, delete
                event_type = 'update'  # Default to update, later determined by operation attribute
            elif 'get' in rpc:
                get_op = rpc.get('get', {})
                filter_elem = get_op.get('filter', {})
                content_to_search = filter_elem
                event_type = 'query'
            elif 'get-config' in rpc:
                get_config = rpc.get('get-config', {})
                filter_elem = get_config.get('filter', {})
                content_to_search = filter_elem
                event_type = 'query'
        elif root_element == 'rpc-reply':
            reply = xml_dict.get('rpc-reply', {})
            if 'data' in reply:
                content_to_search = reply.get('data', {})
                event_type = 'data'
        elif root_element == 'notification':
            notif = xml_dict.get('notification', {})
            content_to_search = notif
            event_type = 'state-change'

        if not content_to_search:
            return

        # Search for carrier-related elements
        self._search_carrier_elements(content_to_search, result, event_type, operation, rpc_msg)

    def _search_carrier_elements(self, element: Any, result: Dict[str, Any],
                                  event_type: str, operation: str,
                                  rpc_msg: RPCMessage = None, depth: int = 0):
        """Recursively search for carrier-related elements"""
        if not isinstance(element, dict) or depth > 15:
            return

        for key, value in element.items():
            if key in self.CARRIER_ELEMENTS:
                # Found carrier-related element
                self._process_carrier_element(key, value, result, event_type, operation, rpc_msg)
            elif not key.startswith('@'):
                # Recursively search child elements
                if isinstance(value, dict):
                    self._search_carrier_elements(value, result, event_type, operation, rpc_msg, depth + 1)
                elif isinstance(value, list):
                    for item in value:
                        self._search_carrier_elements(item, result, event_type, operation, rpc_msg, depth + 1)

    def _process_carrier_element(self, carrier_type: str, carrier_data: Any,
                                  result: Dict[str, Any], event_type: str,
                                  operation: str, rpc_msg: RPCMessage = None):
        """Process single carrier element"""
        # Filter: Skip RU->DU static-low-level endpoints
        if (result['direction'] == 'RU->DU' and
            carrier_type in ['static-low-level-rx-endpoints', 'static-low-level-tx-endpoints']):
            return  # Skip these events

        # carrier_data could be single object or list
        carriers = carrier_data if isinstance(carrier_data, list) else [carrier_data]

        for carrier in carriers:
            if not isinstance(carrier, dict):
                continue

            # Extract carrier name
            carrier_name = carrier.get('name') or carrier.get('carrier-name') or \
                          carrier.get('id') or carrier.get('endpoint-name') or \
                          carrier.get('link-name') or 'unknown'

            # Extract state
            state = carrier.get('state') or carrier.get('admin-state') or \
                   carrier.get('operational-state') or carrier.get('active')

            # Detect operation type (based on NETCONF operation attribute)
            nc_operation = carrier.get('@nc:operation') or carrier.get('@operation')
            if nc_operation:
                if nc_operation == 'create':
                    event_type = 'create'
                elif nc_operation == 'delete':
                    event_type = 'delete'
                elif nc_operation in ['merge', 'replace']:
                    event_type = 'update'

            # Collect carrier details
            details = {}
            for k, v in carrier.items():
                if not k.startswith('@') and k not in ['name', 'carrier-name', 'id']:
                    if isinstance(v, (str, int, float, bool)):
                        details[k] = v
                    elif isinstance(v, dict) and '#text' in v:
                        details[k] = v['#text']

            # Create CarrierEvent
            carrier_event = CarrierEvent(
                log_file_id=self.log_file.id,
                rpc_message_id=rpc_msg.id if rpc_msg and hasattr(rpc_msg, 'id') else None,
                line_number=result['line_number'],
                timestamp=result['timestamp'],
                session_id=result['session_id'],
                event_type=event_type,
                carrier_type=carrier_type,
                carrier_name=str(carrier_name),
                state=str(state) if state else None,
                operation=operation,
                direction=result['direction'],
                message_type=result.get('message_type', 'rpc'),
                carrier_details=json.dumps(details, ensure_ascii=False) if details else None,
                xml_content=result['xml_content']
            )

            self.carrier_events.append(carrier_event)
