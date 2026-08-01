"""GET /health — liveness check."""
from backend.app.config import settings
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": settings.app_version,
        "app": settings.app_name,
    }
