"""
Application Configuration
"""

from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    """Application configuration"""

    # App settings
    APP_NAME: str = "O-RAN Log Parser"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./oran_parser.db"

    # File upload
    UPLOAD_DIR: Path = Path("uploads")
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB

    # CORS - 允许的来源列表
    # 生产环境应该设置为具体的域名
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # 信任的 Host 列表
    ALLOWED_HOSTS: List[str] = [
        "localhost",
        "127.0.0.1",
        "*.nokia.com",
    ]

    # Rate Limiting 配置
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"  # 默认限制
    RATE_LIMIT_LOGIN: str = "10/minute"  # 登录接口限制

    # Base Path 配置（用于反向代理）
    BASE_PATH: str = ""  # 例如 "/rpc-parser"

    class Config:
        env_file = ".env"
        extra = "ignore"  # 忽略未定义的环境变量


settings = Settings()

# Ensure upload directory exists
settings.UPLOAD_DIR.mkdir(exist_ok=True)
