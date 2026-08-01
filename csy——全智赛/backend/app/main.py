"""FastAPI application entry point."""
from backend.app.api.agents import router as agents_router
from backend.app.api.evaluations import router as evaluations_router
from backend.app.api.health import router as health_router
from backend.app.config import settings
from backend.app.exception_handlers import (
    generic_exception_handler,
    validation_exception_handler,
)
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# CORS — required for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Routes
app.include_router(health_router)
app.include_router(agents_router)
app.include_router(evaluations_router)
