// User types - 简化版
export interface User {
  id: number;
  username: string;
  created_at: string;
  last_login?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

// File types
export interface LogFile {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  upload_time: string;
  parse_status: 'pending' | 'parsing' | 'completed' | 'failed';
  parse_error?: string;
  total_lines: number;
  total_messages: number;
  error_count: number;
}

export interface ExtractedFile {
  filename: string;
  relative_path: string;
  absolute_path: string;
  size: number;
}

export interface ExtractedFilesResponse {
  temp_directory: string;
  original_filename: string;
  files: ExtractedFile[];
  total_files: number;
}

// RPC Message types
export interface RPCMessage {
  id: number;
  line_number: number;
  timestamp?: string;
  session_id: number;
  host: string;
  message_id?: string;
  message_type: 'rpc' | 'rpc-reply' | 'notification';
  direction: 'DU->RU' | 'RU->DU';
  operation?: string;
  yang_module?: string;
  response_time_ms?: number;
  has_response: boolean;
  xml_content?: string;
}

// Error Message types
export interface ErrorMessage {
  id: number;
  line_number: number;
  timestamp?: string;
  session_id: number;
  error_type: 'rpc-error' | 'fault' | 'warning';
  error_tag?: string;
  error_severity?: string;
  error_message?: string;
  fault_id?: string;
  fault_source?: string;
  is_cleared: boolean;
  xml_content?: string;
}

// Carrier Event types
export interface CarrierEvent {
  id: number;
  line_number: number;
  timestamp?: string;
  session_id: number;
  event_type: 'create' | 'update' | 'delete' | 'state-change' | 'query' | 'data';
  carrier_type: string;
  carrier_name: string;
  state?: string;
  previous_state?: string;
  operation: string;
  direction: 'DU->RU' | 'RU->DU';
  message_type: string;
  carrier_details?: string;
  xml_content?: string;
}

export interface CarrierStatistics {
  total_events: number;
  by_carrier_type: Record<string, number>;
  by_event_type: Record<string, number>;
  by_state: Record<string, number>;
  carrier_names: string[];
}

export interface CarrierTimeline {
  carrier_name: string;
  total_events: number;
  events: {
    id: number;
    timestamp?: string;
    line_number: number;
    event_type: string;
    carrier_type: string;
    state?: string;
    operation: string;
    direction: string;
    message_type: string;
  }[];
}

// Statistics types
export interface ParseStatistics {
  total_lines: number;
  total_messages: number;
  rpc_count: number;
  rpc_reply_count: number;
  notification_count: number;
  error_count: number;
  fault_count: number;
  operation_stats: Record<string, number>;
  direction_stats: Record<string, number>;
  avg_response_time_ms?: number;
  max_response_time_ms?: number;
  min_response_time_ms?: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  messages: T[];
  total: number;
  page: number;
  page_size: number;
}
