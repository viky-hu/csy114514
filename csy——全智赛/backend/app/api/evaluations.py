"""Persistent Evaluation API and SQLite-backed SSE stream."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Header, Query, Request, Response
from fastapi.responses import JSONResponse
from fastapi.sse import EventSourceResponse, format_sse_event
from pydantic import BaseModel, Field

from backend.app.domain.enums import EventType
from backend.app.domain.evaluation_comparison import EvaluationComparison
from backend.app.domain.evaluation_report import EvaluationReport
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.execution_trace import ExecutionTrace
from backend.app.persistence.sqlite_store import IdempotencyConflictError
from backend.app.services import evaluation_service

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


class CreateEvaluationRequest(BaseModel):
    request_id: str = Field(..., min_length=1)
    agent_id: str = Field(..., min_length=1)
    test_case_ids: list[str] = Field(..., min_length=1)


class CreateEvaluationComparisonRequest(BaseModel):
    request_id: str = Field(..., min_length=1)
    test_case_ids: list[str] = Field(..., min_length=1)


class RetryEvaluationComparisonRequest(BaseModel):
    side: str = Field(..., pattern="^(bare|defended)$")


class EvaluationComparisonSnapshot(EvaluationComparison):
    bare_run: EvaluationRun
    defended_run: EvaluationRun | None = None


class EvaluationComparisonReport(BaseModel):
    comparison_id: str
    mode: str
    test_case_ids: list[str]
    status: str
    bare_run_id: str
    defended_run_id: str | None
    summary: dict[str, Any]
    results: list[dict[str, Any]]


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any]


class ApiErrorResponse(BaseModel):
    error: ApiErrorDetail


def _error(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            }
        },
    )


def _coordinator():
    try:
        return evaluation_service.coordinator()
    except RuntimeError:
        return None


@router.post(
    "",
    response_model=EvaluationRun,
    responses={409: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def create_evaluation(req: CreateEvaluationRequest, response: Response):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        run, created = coordinator.create(
            request_id=req.request_id,
            agent_id=req.agent_id,
            test_case_ids=req.test_case_ids,
        )
    except evaluation_service.InvalidTestCaseSelectionError:
        return _error(
            422,
            "INVALID_TEST_CASE_SELECTION",
            "All test_case_ids must exist in the security TestCase catalog.",
            {"test_case_ids": req.test_case_ids},
        )
    except evaluation_service.InvalidAgentSelectionError:
        return _error(
            422,
            "INVALID_AGENT_SELECTION",
            "agent_id must refer to a registered Agent.",
            {"agent_id": req.agent_id},
        )
    except IdempotencyConflictError:
        return _error(
            409,
            "IDEMPOTENCY_CONFLICT",
            "The request_id was already used with different request data.",
            {"request_id": req.request_id},
        )
    response.status_code = 201 if created else 200
    return run


@router.post(
    "/comparisons",
    response_model=EvaluationComparisonSnapshot,
    responses={409: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def create_evaluation_comparison(
    req: CreateEvaluationComparisonRequest,
    response: Response,
):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        comparison, created = coordinator.create_comparison(
            request_id=req.request_id,
            test_case_ids=req.test_case_ids,
        )
    except evaluation_service.InvalidTestCaseSelectionError:
        return _error(
            422,
            "INVALID_TEST_CASE_SELECTION",
            "All test_case_ids must exist in the security TestCase catalog.",
            {"test_case_ids": req.test_case_ids},
        )
    except IdempotencyConflictError:
        return _error(
            409,
            "IDEMPOTENCY_CONFLICT",
            "The request_id was already used with different request data.",
            {"request_id": req.request_id},
        )
    response.status_code = 201 if created else 200
    return coordinator.comparison_snapshot(comparison.comparison_id)


@router.get("/comparisons/{comparison_id}", response_model=EvaluationComparisonSnapshot)
async def get_evaluation_comparison(comparison_id: str):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        return coordinator.comparison_snapshot(comparison_id)
    except evaluation_service.ComparisonNotFoundError:
        return _error(
            404,
            "COMPARISON_NOT_FOUND",
            "Comparison was not found.",
            {"comparison_id": comparison_id},
        )


@router.get("/comparisons/{comparison_id}/report", response_model=EvaluationComparisonReport)
async def get_evaluation_comparison_report(comparison_id: str):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        return coordinator.comparison_report(comparison_id)
    except evaluation_service.ComparisonNotFoundError:
        return _error(
            404,
            "COMPARISON_NOT_FOUND",
            "Comparison was not found.",
            {"comparison_id": comparison_id},
        )


@router.post("/comparisons/{comparison_id}/retry", response_model=EvaluationComparisonSnapshot)
async def retry_evaluation_comparison(
    comparison_id: str,
    req: RetryEvaluationComparisonRequest,
):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        coordinator.retry_comparison(comparison_id, req.side)
        return coordinator.comparison_snapshot(comparison_id)
    except evaluation_service.ComparisonNotFoundError:
        return _error(
            404,
            "COMPARISON_NOT_FOUND",
            "Comparison was not found.",
            {"comparison_id": comparison_id},
        )
    except evaluation_service.ComparisonNotStartableError as exc:
        return _error(
            409,
            "COMPARISON_NOT_RETRYABLE",
            "The selected comparison side cannot be retried.",
            {"reason": str(exc), "side": req.side},
        )


@router.get("/comparisons/{comparison_id}/events")
async def stream_evaluation_comparison_events(
    comparison_id: str,
    request: Request,
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        coordinator.get_comparison(comparison_id)
    except evaluation_service.ComparisonNotFoundError:
        return _error(
            404,
            "COMPARISON_NOT_FOUND",
            "Comparison was not found.",
            {"comparison_id": comparison_id},
        )

    async def generate():
        cursor = max(after, _comparison_cursor_from_event_id(comparison_id, last_event_id))
        loop = asyncio.get_running_loop()
        last_heartbeat = loop.time()
        while True:
            if await request.is_disconnected():
                return
            batch = coordinator.list_comparison_events(comparison_id, after=cursor)
            for item in batch:
                cursor = item["seq"]
                yield format_sse_event(
                    data_str=json.dumps(item, ensure_ascii=False, separators=(",", ":")),
                    id=f"{comparison_id}:{cursor}",
                    retry=3000,
                )
            comparison = coordinator.get_comparison(comparison_id)
            if comparison.status in {"completed", "partial", "failed"} and not batch:
                return
            if loop.time() - last_heartbeat >= 15:
                yield format_sse_event(comment="heartbeat")
                last_heartbeat = loop.time()
            await asyncio.sleep(0.25)

    return EventSourceResponse(
        generate(),
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _comparison_cursor_from_event_id(comparison_id: str, last_event_id: str | None) -> int:
    if not last_event_id:
        return 0
    prefix, separator, raw_cursor = last_event_id.partition(":")
    if prefix != comparison_id or not separator:
        return 0
    try:
        cursor = int(raw_cursor)
    except ValueError:
        return 0
    return max(cursor, 0)


@router.post(
    "/{evaluation_id}/start",
    response_model=EvaluationRun,
    responses={404: {"model": ApiErrorResponse}, 409: {"model": ApiErrorResponse}},
)
async def start_evaluation(evaluation_id: str, response: Response):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        run, status_code = coordinator.start(evaluation_id)
    except evaluation_service.EvaluationNotFoundError:
        return _not_found(evaluation_id)
    except evaluation_service.EvaluationNotStartableError as exc:
        return _error(
            409,
            "EVALUATION_NOT_STARTABLE",
            "Evaluation cannot be started from its current state.",
            {"status": str(exc)},
        )
    response.status_code = status_code
    return run


def _not_found(evaluation_id: str) -> JSONResponse:
    return _error(
        404,
        "EVALUATION_NOT_FOUND",
        "Evaluation was not found.",
        {"evaluation_id": evaluation_id},
    )


@router.get("/{evaluation_id}", response_model=EvaluationRun)
async def get_evaluation(evaluation_id: str):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        return coordinator.get(evaluation_id)
    except evaluation_service.EvaluationNotFoundError:
        return _not_found(evaluation_id)


@router.get("/{evaluation_id}/trace", response_model=ExecutionTrace)
async def get_evaluation_trace(evaluation_id: str):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        return coordinator.get_trace(evaluation_id)
    except evaluation_service.EvaluationNotFoundError:
        return _not_found(evaluation_id)


@router.get("/{evaluation_id}/report", response_model=EvaluationReport)
async def get_evaluation_report(evaluation_id: str):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        return coordinator.get_report(evaluation_id)
    except evaluation_service.EvaluationNotFoundError:
        return _not_found(evaluation_id)
    except evaluation_service.ReportNotReadyError:
        return _error(
            409,
            "REPORT_NOT_READY",
            "Evaluation report is not ready.",
            {"evaluation_id": evaluation_id},
        )


@router.get("/{evaluation_id}/events")
async def stream_evaluation_events(
    evaluation_id: str,
    request: Request,
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
):
    coordinator = _coordinator()
    if coordinator is None:
        return _error(503, "EVALUATION_SERVICE_UNAVAILABLE", "Evaluation service is unavailable.")
    try:
        cursor = coordinator.validate_cursor(evaluation_id, last_event_id, after)
    except evaluation_service.EvaluationNotFoundError:
        return _not_found(evaluation_id)
    except evaluation_service.InvalidEventCursorError:
        return _error(
            400,
            "INVALID_EVENT_CURSOR",
            "Event cursor is invalid for this evaluation.",
            {"evaluation_id": evaluation_id},
        )

    async def generate():
        nonlocal cursor
        loop = asyncio.get_running_loop()
        last_heartbeat = loop.time()
        while True:
            if await request.is_disconnected():
                return
            batch = coordinator.list_events(evaluation_id, after_seq=cursor)
            for stored in batch:
                cursor = stored.seq
                yield format_sse_event(
                    data_str=json.dumps(
                        stored.model_dump(mode="json", exclude={"seq"}),
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    id=f"{evaluation_id}:{stored.seq}",
                    retry=3000,
                )
                if stored.type in {EventType.PREFLIGHT_FAILED, EventType.RUN_FINISHED}:
                    return
            run = coordinator.get(evaluation_id)
            if coordinator.is_terminal(run) and cursor >= run.last_event_seq:
                return
            if loop.time() - last_heartbeat >= 15:
                yield format_sse_event(comment="heartbeat")
                last_heartbeat = loop.time()
            await asyncio.sleep(0.25)

    return EventSourceResponse(
        generate(),
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
