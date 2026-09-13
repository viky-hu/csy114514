"""Owner-scoped Red Team connection, run, report and SSE endpoints."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.sse import EventSourceResponse, format_sse_event

from backend.app.config import settings
from backend.app.domain.redteam_run import (
    CreateRedTeamConnectionRequest,
    CreateRedTeamRunRequest,
    RedTeamConnection,
    RedTeamRun,
)
from backend.app.services import redteam_service
from backend.app.services.redteam_adapter import AdapterProtocolError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/redteam", tags=["redteam"])

def _error(status: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details or {}}})


def _owner_from_bff(
    x_redteam_owner: str | None = Header(default=None),
    x_redteam_signature: str | None = Header(default=None),
) -> str:
    """Accept only a BFF-signed account subject; browser input is never trusted."""
    secret = settings.redteam_bff_signing_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Red-team BFF signing is not configured.")
    if not x_redteam_owner or not x_redteam_signature:
        raise HTTPException(status_code=401, detail="A signed red-team owner context is required.")
    expected = hmac.new(secret.encode("utf-8"), x_redteam_owner.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_redteam_signature):
        raise HTTPException(status_code=403, detail="Red-team owner signature is invalid.")
    return x_redteam_owner


def _coordinator():
    try:
        return redteam_service.coordinator()
    except RuntimeError:
        return None


@router.post("/connections", response_model=RedTeamConnection, status_code=201)
async def create_connection(request: CreateRedTeamConnectionRequest, owner_id: str = Depends(_owner_from_bff)):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    try:
        return await asyncio.to_thread(coordinator.create_connection, owner_id, request)
    except ValueError as exc:
        return _error(422, "INVALID_ADAPTER_CONNECTION", str(exc))
    except (AdapterProtocolError, httpx.HTTPError) as exc:
        logger.info("Red-team adapter verification failed: %s", exc)
        return _error(422, "ADAPTER_VERIFICATION_FAILED", "The adapter did not satisfy the test-target contract.")


@router.get("/connections", response_model=list[RedTeamConnection])
async def list_connections(agent_id: str | None = None, owner_id: str = Depends(_owner_from_bff)):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    return coordinator.list_connections(owner_id, agent_id)


@router.post("/runs", response_model=RedTeamRun, status_code=202)
async def create_run(request: CreateRedTeamRunRequest, owner_id: str = Depends(_owner_from_bff)):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    try:
        return coordinator.create_run(owner_id, request)
    except redteam_service.RedTeamNotFoundError:
        return _error(404, "REDTEAM_CONNECTION_NOT_FOUND", "Red-team connection was not found.")
    except redteam_service.RedTeamConnectionBusyError:
        return _error(409, "REDTEAM_CONNECTION_BUSY", "This adapter already has an active red-team run.")


@router.get("/runs", response_model=list[RedTeamRun])
async def list_runs(owner_id: str = Depends(_owner_from_bff)):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    return coordinator.list_runs(owner_id)


@router.get("/runs/{run_id}", response_model=RedTeamRun)
async def get_run(run_id: str, owner_id: str = Depends(_owner_from_bff)):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    try:
        return coordinator.get_run(run_id, owner_id)
    except redteam_service.RedTeamNotFoundError:
        return _error(404, "REDTEAM_RUN_NOT_FOUND", "Red-team run was not found.")


@router.get("/runs/{run_id}/report")
async def get_run_report(run_id: str, owner_id: str = Depends(_owner_from_bff)):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    try:
        return coordinator.get_report(run_id, owner_id)
    except redteam_service.RedTeamNotFoundError:
        return _error(404, "REDTEAM_RUN_NOT_FOUND", "Red-team run was not found.")
    except redteam_service.RedTeamReportNotReadyError as exc:
        return _error(409, "REDTEAM_REPORT_NOT_READY", str(exc))


@router.get("/runs/{run_id}/events")
async def stream_run_events(
    run_id: str,
    request: Request,
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    owner_id: str = Depends(_owner_from_bff),
):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "REDTEAM_SERVICE_UNAVAILABLE", "Red-team service is unavailable.")
    try:
        coordinator.get_run(run_id, owner_id)
    except redteam_service.RedTeamNotFoundError:
        return _error(404, "REDTEAM_RUN_NOT_FOUND", "Red-team run was not found.")
    cursor = after
    if last_event_id:
        prefix, _, raw_seq = last_event_id.rpartition(":")
        if prefix == run_id and raw_seq.isdigit():
            cursor = max(cursor, int(raw_seq))

    async def generate():
        nonlocal cursor
        loop = asyncio.get_running_loop()
        last_heartbeat = loop.time()
        while True:
            if await request.is_disconnected():
                return
            for event in coordinator.list_events(run_id, owner_id, cursor):
                cursor = event.seq
                yield format_sse_event(
                    data_str=json.dumps(event.model_dump(mode="json", exclude={"seq"}), ensure_ascii=False, separators=(",", ":")),
                    id=f"{run_id}:{event.seq}", retry=3000,
                )
            run = coordinator.get_run(run_id, owner_id)
            if run.status in {"completed", "failed"} and cursor >= run.last_event_seq:
                return
            if loop.time() - last_heartbeat >= 15:
                yield format_sse_event(comment="heartbeat")
                last_heartbeat = loop.time()
            await asyncio.sleep(0.25)

    return EventSourceResponse(generate(), headers={
        "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive",
    })
