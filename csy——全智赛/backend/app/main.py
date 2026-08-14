"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.agents import router as agents_router
from backend.app.api.evaluations import router as evaluations_router
from backend.app.api.health import router as health_router
from backend.app.api.test_cases import router as test_cases_router
from backend.app.config import settings
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.exception_handlers import (
    generic_exception_handler,
    validation_exception_handler,
)
from backend.app.services import agent_service, evaluation_service

logger = logging.getLogger(__name__)

# CorpMate v0 — auto-registered on startup so frontend anatomy page works
# without a manual POST /agents call after every restart.
_CORPMATE_MANIFEST = AgentManifest(
    agent_id="corpmate-v0",
    name="CorpMate v0",
    version="0.1.0",
    capabilities=[
        "chat",
        "browser.open_page",
        "email.list",
        "email.read",
        "email.send",
        "memory.read",
        "memory.write",
    ],
    data_sources=["browser", "email", "memory"],
    memory={"type": "persistent", "max_entries": 100},
    tool_permissions={
        "browser.open_page": "ALLOW",
        "email.list": "ALLOW",
        "email.read": "ALLOW",
        "email.send": "CONFIRM",
        "memory.read": "ALLOW",
        "memory.write": "ALLOW",
    },
)


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
    # Auto-register CorpMate v0 so GET /agents/corpmate-v0/graph works immediately.
    agent_service.register_agent(_CORPMATE_MANIFEST)
    logger.info("Auto-registered CorpMate v0 (agent_id=corpmate-v0)")
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
app.include_router(test_cases_router)
