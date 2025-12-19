"""
Pydantic Schemas for API Request/Response
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ==================== Auth Schemas ====================

class UserLogin(BaseModel):
    """用户登录 - 只需用户名"""
    username: str = Field(..., min_length=1, max_length=50)


class UserResponse(BaseModel):
    """用户响应"""
    id: int
    username: str
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token 响应"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ==================== File Schemas ====================

class LogFileCreate(BaseModel):
    """文件上传响应"""
    id: int
    filename: str
    original_filename: str
    file_size: int
    upload_time: datetime
    parse_status: str


class LogFileResponse(BaseModel):
    """文件详情响应"""
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
    """文件列表响应"""
    files: List[LogFileResponse]
    total: int


class ExtractedFileInfo(BaseModel):
    """解压后的文件信息"""
    filename: str
    relative_path: str
    absolute_path: str
    size: int


class ExtractedFilesResponse(BaseModel):
    """文件解压响应"""
    temp_directory: str
    original_filename: str
    files: List[Dict[str, Any]]
    total_files: int


class ParseSelectedFilesRequest(BaseModel):
    """解析选定文件请求"""
    temp_directory: str
    original_filename: str
    selected_files: List[Dict[str, Any]]


# ==================== RPC Message Schemas ====================

class RPCMessageResponse(BaseModel):
    """RPC 消息响应"""
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
    """RPC 消息详情（含 XML）"""
    xml_content: Optional[str]


class RPCMessageList(BaseModel):
    """RPC 消息列表"""
    messages: List[RPCMessageResponse]
    total: int
    page: int
    page_size: int


# ==================== Error Message Schemas ====================

class ErrorMessageResponse(BaseModel):
    """错误消息响应"""
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
    """错误消息详情（含 XML）"""
    xml_content: Optional[str]


class ErrorMessageList(BaseModel):
    """错误消息列表"""
    messages: List[ErrorMessageResponse]
    total: int
    page: int
    page_size: int


# ==================== Carrier Event Schemas ====================

class CarrierEventResponse(BaseModel):
    """Carrier 事件响应"""
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
    """Carrier 事件详情（含 XML 和详细信息）"""
    carrier_details: Optional[str]
    xml_content: Optional[str]


class CarrierEventList(BaseModel):
    """Carrier 事件列表"""
    events: List[CarrierEventResponse]
    total: int
    page: int
    page_size: int


class CarrierStatistics(BaseModel):
    """Carrier 统计"""
    total_events: int
    by_carrier_type: dict  # 按 carrier 类型统计
    by_event_type: dict  # 按事件类型统计 (create, update, delete, etc.)
    by_state: dict  # 按状态统计
    carrier_names: List[str]  # 所有 carrier 名称列表


# ==================== Statistics Schemas ====================

class ParseStatistics(BaseModel):
    """解析统计"""
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
