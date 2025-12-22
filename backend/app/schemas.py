"""
Pydantic Schemas for API Request/Response
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ==================== Auth Schemas ====================

class UserLogin(BaseModel):
    """User login - username only"""
    username: str = Field(..., min_length=1, max_length=50)


class UserResponse(BaseModel):
    """User response"""
    id: int
    username: str
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token response"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ==================== File Schemas ====================

class LogFileCreate(BaseModel):
    """File upload response"""
    id: int
    filename: str
    original_filename: str
    file_size: int
    upload_time: datetime
    parse_status: str


class LogFileResponse(BaseModel):
    """File detail response"""
    id: int
    filename: str
    original_filename: str
    file_size: int
    upload_time: datetime
    parse_status: str
    parse_error: Optional[str] = None
    total_lines: int
    total_messages: int
    error_count: int

    class Config:
        from_attributes = True


class LogFileList(BaseModel):
    """File list response"""
    files: List[LogFileResponse]
    total: int


class ExtractedFileInfo(BaseModel):
    """Extracted file information"""
    filename: str
    relative_path: str
    absolute_path: str
    size: int


class ExtractedFilesResponse(BaseModel):
    """文件解压Response"""
    temp_directory: str
    original_filename: str
    files: List[Dict[str, Any]]
    total_files: int


class ParseSelectedFilesRequest(BaseModel):
    """Parse selected files request"""
    temp_directory: str
    original_filename: str
    selected_files: List[Dict[str, Any]]


# ==================== RPC Message Schemas ====================

class RPCMessageResponse(BaseModel):
    """RPC messageResponse"""
    id: int
    line_number: int
    timestamp: Optional[datetime]
    session_id: int
    host: str
    message_id: Optional[str]
    message_type: str
    direction: str
    operation: Optional[str]
    yang_module: Optional[str]
    response_time_ms: Optional[float]
    has_response: bool

    class Config:
        from_attributes = True


class RPCMessageDetail(RPCMessageResponse):
    """RPC message详情（含 XML）"""
    xml_content: Optional[str]


class RPCMessageList(BaseModel):
    """RPC message列表"""
    messages: List[RPCMessageResponse]
    total: int
    page: int
    page_size: int


# ==================== Error Message Schemas ====================

class ErrorMessageResponse(BaseModel):
    """Error messageResponse"""
    id: int
    line_number: int
    timestamp: Optional[datetime]
    session_id: int
    error_type: str
    error_tag: Optional[str]
    error_severity: Optional[str]
    error_message: Optional[str]
    fault_id: Optional[str]
    fault_source: Optional[str]
    is_cleared: bool

    class Config:
        from_attributes = True


class ErrorMessageDetail(ErrorMessageResponse):
    """Error message详情（含 XML）"""
    xml_content: Optional[str]


class ErrorMessageList(BaseModel):
    """Error message列表"""
    messages: List[ErrorMessageResponse]
    total: int
    page: int
    page_size: int


# ==================== Carrier Event Schemas ====================

class CarrierEventResponse(BaseModel):
    """Carrier eventResponse"""
    id: int
    line_number: int
    timestamp: Optional[datetime]
    session_id: int
    event_type: str  # create, update, delete, state-change, query, data
    carrier_type: str  # rx-array-carriers, tx-array-carriers, etc.
    carrier_name: str
    state: Optional[str]
    previous_state: Optional[str]
    operation: str
    direction: str
    message_type: str

    class Config:
        from_attributes = True


class CarrierEventDetail(CarrierEventResponse):
    """Carrier event详情（含 XML 和详细信息）"""
    carrier_details: Optional[str]
    xml_content: Optional[str]


class CarrierEventList(BaseModel):
    """Carrier event列表"""
    events: List[CarrierEventResponse]
    total: int
    page: int
    page_size: int


class CarrierStatistics(BaseModel):
    """Carrier 统计"""
    total_events: int
    by_carrier_type: dict  # 按 carrier Type统计
    by_event_type: dict  # 按Event type统计 (create, update, delete, etc.)
    by_state: dict  # 按状态统计
    carrier_names: List[str]  # 所有 carrier 名称列表


# ==================== Statistics Schemas ====================

class ParseStatistics(BaseModel):
    """Parse统计"""
    total_lines: int
    total_messages: int
    rpc_count: int
    rpc_reply_count: int
    notification_count: int
    error_count: int
    fault_count: int

    # By operation type
    operation_stats: dict

    # By message direction
    direction_stats: dict

    # Response time stats
    avg_response_time_ms: Optional[float]
    max_response_time_ms: Optional[float]
    min_response_time_ms: Optional[float]
