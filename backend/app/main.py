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
from .middleware.reverse_proxy import PrefixStripMiddleware


# Rate Limiter configuration
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


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="O-RAN RPC Message Log Parsing and Analysis System API",
    lifespan=lifespan,
    # Add base path for OpenAPI documentation when behind reverse proxy
    root_path=settings.BASE_PATH,
)

# Add Rate Limiter to application state
app.state.limiter = limiter


# ==================== Security Middleware ====================

# Rate Limit exceeded handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded"""
    return Response(
        content='{"detail": "Too many requests. Please slow down."}',
        status_code=429,
        media_type="application/json",
        headers={"Retry-After": "60"},
    )


# Security headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security response headers"""
    response = await call_next(request)

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Permissions policy (restrict certain browser features)
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    # Enable HSTS only in production (force HTTPS)
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


# Rate Limiting Middleware
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(SlowAPIMiddleware)


# CORS Middleware - configure cross-origin access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"],
)


# Trusted Host Middleware - prevent Host header attacks
# Note: may need to disable in development environment
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS,
    )


# Prefix Strip Middleware - for reverse proxy deployment
# Strips URL prefix from requests when deployed behind a reverse proxy
# Supports X-Forwarded-Prefix header or PREFIX environment variable
app.add_middleware(PrefixStripMiddleware, prefix=settings.BASE_PATH or None)


# ==================== API Routes ====================

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


# ==================== Static File Serving ====================

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
