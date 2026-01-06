"""
O-RAN RPC Log Parser - FastAPI Application
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .database import init_db
from .routes import auth_router, files_router, messages_router, carriers_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    await init_db()
    yield
    # Shutdown
    pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="O-RAN RPC Message Log Parsing and Analysis System API",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (must be before catch-all routes)
app.include_router(auth_router, prefix="/api")
app.include_router(files_router, prefix="/api")
app.include_router(messages_router, prefix="/api")
app.include_router(carriers_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check"""
    return {"status": "healthy", "version": settings.APP_VERSION}


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
