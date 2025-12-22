"""
Database Configuration and Models
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from .config import settings


# Create async engine
# echo=False to disable SQL query logging (reduces log noise)
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Create async session factory
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for models"""
    pass


class User(Base):
    """用户Model - 简化版，只需用户名"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow)

    # Relationships
    files = relationship("LogFile", back_populates="owner", cascade="all, delete-orphan")


class LogFile(Base):
    """日志文件Model"""
    __tablename__ = "log_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    upload_time = Column(DateTime, default=datetime.utcnow)
    parse_status = Column(String(20), default="pending")  # pending, parsing, completed, failed
    parse_error = Column(Text, nullable=True)

    # Statistics
    total_lines = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    error_count = Column(Integer, default=0)

    # Owner
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="files")

    # Relationships
    rpc_messages = relationship("RPCMessage", back_populates="log_file", cascade="all, delete-orphan")
    error_messages = relationship("ErrorMessage", back_populates="log_file", cascade="all, delete-orphan")
    carrier_events = relationship("CarrierEvent", back_populates="log_file", cascade="all, delete-orphan")


class RPCMessage(Base):
    """RPC messageModel"""
    __tablename__ = "rpc_messages"

    id = Column(Integer, primary_key=True, index=True)
    log_file_id = Column(Integer, ForeignKey("log_files.id"), nullable=False)

    # Basic info
    line_number = Column(Integer)
    timestamp = Column(DateTime)
    session_id = Column(Integer)
    host = Column(String(50))

    # Message details
    message_id = Column(String(50))
    message_type = Column(String(50))  # rpc, rpc-reply, notification
    direction = Column(String(20))  # DU->RU, RU->DU
    operation = Column(String(100))  # get, edit-config, etc.
    yang_module = Column(String(200))  # Related YANG module/namespace

    # Response info (for RPC pairs)
    response_time_ms = Column(Float, nullable=True)
    has_response = Column(Boolean, default=False)

    # Raw content (optional, for detailed view)
    xml_content = Column(Text, nullable=True)

    log_file = relationship("LogFile", back_populates="rpc_messages")


class ErrorMessage(Base):
    """Error messageModel"""
    __tablename__ = "error_messages"

    id = Column(Integer, primary_key=True, index=True)
    log_file_id = Column(Integer, ForeignKey("log_files.id"), nullable=False)

    # Basic info
    line_number = Column(Integer)
    timestamp = Column(DateTime)
    session_id = Column(Integer)

    # Error details
    error_type = Column(String(50))  # rpc-error, fault, warning
    error_tag = Column(String(100))
    error_severity = Column(String(50))
    error_message = Column(Text)

    # For fault notifications
    fault_id = Column(String(100), nullable=True)
    fault_source = Column(String(200), nullable=True)
    is_cleared = Column(Boolean, default=False)

    # Raw content
    xml_content = Column(Text, nullable=True)

    log_file = relationship("LogFile", back_populates="error_messages")


class CarrierEvent(Base):
    """Carrier eventModel - 跟踪 array-carriers, low-level-endpoints, low-level-links 等"""
    __tablename__ = "carrier_events"

    id = Column(Integer, primary_key=True, index=True)
    log_file_id = Column(Integer, ForeignKey("log_files.id"), nullable=False)
    rpc_message_id = Column(Integer, ForeignKey("rpc_messages.id"), nullable=True)

    # Basic info
    line_number = Column(Integer)
    timestamp = Column(DateTime)
    session_id = Column(Integer)

    # Event details
    event_type = Column(String(50))  # create, update, delete, state-change
    carrier_type = Column(String(100))  # rx-array-carriers, tx-array-carriers, low-level-rx-links, low-level-tx-links, low-level-rx-endpoints, low-level-tx-endpoints
    carrier_name = Column(String(200))  # carrier 名称/ID

    # Carrier state
    state = Column(String(50), nullable=True)  # DISABLED, READY, BUSY, etc.
    previous_state = Column(String(50), nullable=True)  # 之前的状态（Used for状态变化）

    # Operation info
    operation = Column(String(50))  # get, edit-config, notification
    direction = Column(String(20))  # DU->RU, RU->DU
    message_type = Column(String(50))  # rpc, rpc-reply, notification

    # Additional carrier info (JSON-like string for flexibility)
    carrier_details = Column(Text, nullable=True)  # 存储额外的 carrier 属性

    # Raw content
    xml_content = Column(Text, nullable=True)

    log_file = relationship("LogFile", back_populates="carrier_events")
    rpc_message = relationship("RPCMessage")


async def init_db():
    """初始化Database"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """获取DatabaseSession"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
