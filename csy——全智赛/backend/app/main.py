"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.agents import router as agents_router
from backend.app.api.evaluations import router as evaluations_router
from backend.app.api.health import router as health_router
from backend.app.config import settings
from backend.app.exception_handlers import (
    generic_exception_handler,
    validation_exception_handler,
)
from backend.app.services import evaluation_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.trace_fingerprint_key:
        raise RuntimeError("TRACE_FINGERPRINT_KEY is required")
    settings.evaluation_database_path.parent.mkdir(parents=True, exist_ok=True)
    evaluation_service.configure(
        database_path=settings.evaluation_database_path,
        fingerprint_key=settings.trace_fingerprint_key,
        start_worker=True,
    )
    try:
        yield
    finally:
        evaluation_service.shutdown()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
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
