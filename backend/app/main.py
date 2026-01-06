"""
O-RAN RPC Log Parser - FastAPI Application
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import settings
from .database import init_db
from .routes import auth_router, files_router, messages_router, carriers_router


# Rate Limiter 配置
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT] if settings.RATE_LIMIT_ENABLED else [],
    enabled=settings.RATE_LIMIT_ENABLED,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    await init_db()
    yield
    # Shutdown
    pass


# 创建 FastAPI 应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="O-RAN RPC Message Log Parsing and Analysis System API",
    lifespan=lifespan,
    # 如果有 base path，添加到 OpenAPI 文档
    root_path=settings.BASE_PATH,
)

# 添加 Rate Limiter 到应用状态
app.state.limiter = limiter


# ==================== 安全 Middleware ====================

# Rate Limit 超限处理
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """处理请求限流"""
    return Response(
        content='{"detail": "Too many requests. Please slow down."}',
        status_code=429,
        media_type="application/json",
        headers={"Retry-After": "60"},
    )


# 安全响应头 Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """添加安全响应头"""
    response = await call_next(request)

    # 防止 MIME 类型嗅探
    response.headers["X-Content-Type-Options"] = "nosniff"

    # 防止点击劫持
    response.headers["X-Frame-Options"] = "DENY"

    # XSS 保护
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # 引用策略
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # 权限策略（限制某些浏览器功能）
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    # 仅在生产环境启用 HSTS（HTTPS 强制）
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


# Rate Limiting Middleware
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(SlowAPIMiddleware)


# CORS Middleware - 配置跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"],
)


# Trusted Host Middleware - 防止 Host 头攻击
# 注意：在开发环境可能需要禁用
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )


# ==================== API 路由 ====================

# Include routers (must be before catch-all routes)
app.include_router(auth_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(messages_router, prefix="/api")
app.include_router(carriers_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG,
    }


# ==================== 静态文件服务 ====================

# Serve frontend static files (must be after API routes)
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    # Mount static assets (JS, CSS, images, etc.)
    assets_path = frontend_dist / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    # Catch-all route for SPA (must be last!)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve frontend SPA"""
        # Serve index.html for root
        if not full_path or full_path == "/":
            return FileResponse(frontend_dist / "index.html")

        # Check if file exists
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        # For client-side routing, serve index.html
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    async def root():
        """Root path - Frontend not built"""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "message": "Frontend not built yet. Please run: cd frontend && npm run build",
            "docs": "/docs",
            "api_health": "/api/health"
        }
