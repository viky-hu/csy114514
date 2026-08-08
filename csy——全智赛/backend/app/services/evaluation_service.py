"""Persistent evaluation coordination for the R4 MVP vertical slice."""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from backend.app.adapter.reference_adapter import ReferenceAgentAdapter
from backend.app.domain.enums import EventType
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.execution_event import ExecutionEvent
from backend.app.domain.execution_trace import ExecutionTrace
from backend.app.domain.test_case import TestCase
from backend.app.judge.r4_judge import judge_r4_events
from backend.app.persistence.sqlite_store import (
    IdempotencyConflictError,
    SQLiteEvaluationStore,
    StoredExecutionEvent,
)
from backend.app.sandbox.composite import CompositeSandbox
from backend.app.security.fingerprints import derive_canary, fingerprint_value
from backend.app.services.preflight_service import PreflightError, PreflightService
from backend.app.services.report_service import build_report


class EvaluationNotFoundError(LookupError):
    pass


class InvalidTestCaseSelectionError(ValueError):
    pass


class EvaluationNotStartableError(RuntimeError):
    pass


class ReportNotReadyError(RuntimeError):
    pass


class InvalidEventCursorError(ValueError):
    pass


_SHARED_ROOT = Path(__file__).resolve().parents[3] / "shared"
_TEST_CASES_PATH = _SHARED_ROOT / "examples" / "security" / "security_testcases.json"
_TERMINAL_STATUSES = {"completed", "failed", "interrupted", "preflight_failed"}


def _event(run_id: str, event_type: EventType, payload: dict) -> ExecutionEvent:
    return ExecutionEvent(
        event_id=f"evt-{uuid.uuid4().hex[:16]}",
        run_id=run_id,
        timestamp=datetime.now(timezone.utc),
        type=event_type,
        payload=payload,
    )


def _execution_event(stored: StoredExecutionEvent) -> ExecutionEvent:
    return ExecutionEvent.model_validate(stored.model_dump(exclude={"seq"}))


class EvaluationCoordinator:
    def __init__(
        self,
        *,
        database_path: str | Path,
        fingerprint_key: str,
        start_worker: bool,
    ) -> None:
        if not fingerprint_key:
            raise RuntimeError("TRACE_FINGERPRINT_KEY is required")
        self.store = SQLiteEvaluationStore(database_path)
        self._fingerprint_key = fingerprint_key
        self._key_id = hashlib.sha256(fingerprint_key.encode("utf-8")).hexdigest()
        unfinished_keys = self.store.unfinished_key_ids()
        if unfinished_keys and unfinished_keys != {self._key_id}:
            self.store.close()
            raise RuntimeError(
                "TRACE_FINGERPRINT_KEY cannot rotate while unfinished evaluations exist"
            )
        self.store.interrupt_running_runs()
        self.store.interrupt_preflighting_runs()
        self._preflight = PreflightService()
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._process_lock = threading.Lock()
        self._prepared_sandboxes: dict[str, CompositeSandbox] = {}
        self._worker: threading.Thread | None = None
        if start_worker:
            self._worker = threading.Thread(
                target=self._worker_loop,
                name="evaluation-worker",
                daemon=True,
            )
            self._worker.start()

    def create(
        self,
        *,
        request_id: str,
        agent_id: str,
        test_case_ids: list[str],
    ) -> tuple[EvaluationRun, bool]:
        if test_case_ids != ["tc_pipi_001"]:
            raise InvalidTestCaseSelectionError
        run_id = f"eval-{uuid.uuid4().hex[:16]}"
        run = EvaluationRun(
            run_id=run_id,
            agent_id=agent_id,
            test_case_ids=test_case_ids,
            status="preflighting",
            created_at=datetime.now(timezone.utc),
            current_stage="web_content_injection",
        )
        created = self.store.create_run(
            run,
            request_id=request_id,
            fingerprint_key_id=self._key_id,
        )
        if not created.created:
            return created.run, False

        try:
            result = self._preflight.prepare(
                run_id=run_id,
                fingerprint_key=self._fingerprint_key,
                test_case_id="tc_pipi_001",
            )
            sandbox = CompositeSandbox(
                fingerprint_value=lambda value_type, value: fingerprint_value(
                    self._fingerprint_key,
                    value,
                    value_type=value_type,
                ),
                canary=derive_canary(self._fingerprint_key, run_id),
                canary_fingerprint=result.metadata.canary_fingerprint,
                enforce_email_confirmation=False,
            )
            sandbox.reset({"browser_pages": {}})
            sandbox.browser.register_page(
                result.browser_page.url,
                asdict(result.browser_page),
            )
            self._verify_page_readable(run_id, result.browser_page.url, sandbox)
            ready = self.store.mark_preflight_ready(
                run_id,
                result.metadata,
                _event(
                    run_id,
                    EventType.PREFLIGHT_COMPLETED,
                    {
                        "stage": "web_content_injection",
                        "fixture_id": result.metadata.fixture_id,
                        "canary_fingerprint": result.metadata.canary_fingerprint,
                    },
                ),
            )
            self._prepared_sandboxes[run_id] = sandbox
            return ready, True
        except PreflightError as exc:
            failed = self.store.mark_preflight_failed(
                run_id,
                code=exc.code,
                message="Evaluation preflight failed.",
                event=_event(
                    run_id,
                    EventType.PREFLIGHT_FAILED,
                    {"stage": "web_content_injection", "error_code": exc.code},
                ),
            )
            return failed, True

    def _verify_page_readable(self, run_id: str, url: str, sandbox: CompositeSandbox) -> None:
        opened = sandbox.execute("browser.open_page", {"url": url})
        canary = derive_canary(self._fingerprint_key, run_id)
        if opened.get("success") is not True or canary not in opened["result"]["content"]:
            raise PreflightError(
                "CANARY_VALIDATION_FAILED",
                "Run-specific page could not be read with the exact canary.",
            )

    def get(self, run_id: str) -> EvaluationRun:
        run = self.store.get_run(run_id)
        if run is None:
            raise EvaluationNotFoundError(run_id)
        return run

    def start(self, run_id: str) -> tuple[EvaluationRun, int]:
        run = self.get(run_id)
        if run.status == "ready":
            self.store.queue_run(run_id)
            run = self.get(run_id)
            self._wake.set()
            return run, 202
        if run.status in {"queued", "running"}:
            return run, 202
        if run.status == "completed":
            return run, 200
        raise EvaluationNotStartableError(run.status)

    def process_queued_once(self) -> bool:
        if not self._process_lock.acquire(blocking=False):
            return False
        try:
            run = self.store.claim_next_queued()
            if run is None:
                return False
            self._execute(run)
            return True
        finally:
            self._process_lock.release()

    def _execute(self, run: EvaluationRun) -> None:
        stage = "persistent_memory_poisoning"
        try:
            preflight = self._preflight.prepare(
                run_id=run.run_id,
                fingerprint_key=self._fingerprint_key,
                test_case_id="tc_pipi_001",
            )
            context = self.store.get_run_context(run.run_id)
            if context is None or any(
                getattr(context, field) != getattr(preflight.metadata, field)
                for field in (
                    "seed_id",
                    "fixture_id",
                    "target_url",
                    "mutation_version",
                    "fixture_digest",
                )
            ):
                raise PreflightError(
                    "CONTEXT_REBUILD_MISMATCH",
                    "Persisted preflight context could not be rebuilt.",
                )

            test_case = self._load_test_case("tc_pipi_001")
            canary = derive_canary(self._fingerprint_key, run.run_id)

            def sink(event_type: str, payload: dict) -> str:
                stored = self.store.append_event(
                    _event(run.run_id, EventType(event_type), payload)
                )
                return stored.event_id

            sandbox = self._prepared_sandboxes.pop(run.run_id, None)
            if sandbox is None:
                sandbox = CompositeSandbox(
                    event_sink=sink,
                    fingerprint_value=lambda value_type, value: fingerprint_value(
                        self._fingerprint_key,
                        value,
                        value_type=value_type,
                    ),
                    canary=canary,
                    canary_fingerprint=preflight.metadata.canary_fingerprint,
                    enforce_email_confirmation=False,
                )
            else:
                sandbox.set_event_sink(sink)
            sandbox.reset(test_case.scenario.initial_state.model_dump())
            sandbox.browser.register_page(
                preflight.browser_page.url,
                {
                    "url": preflight.browser_page.url,
                    "title": preflight.browser_page.title,
                    "content": preflight.browser_page.content,
                },
            )
            adapter = ReferenceAgentAdapter(sandbox=sandbox)
            turns = test_case.scenario.turns
            for index, turn in enumerate(turns):
                stage = (
                    "persistent_memory_poisoning"
                    if index == 0
                    else "unconfirmed_email_send"
                )
                self.store.set_current_stage(run.run_id, stage)
                session_id = f"{run.run_id}-session-{index + 1}"
                if turn.starts_new_session:
                    adapter.begin_new_session()
                sandbox.set_execution_context(
                    turn_id=turn.turn_id,
                    session_id=session_id,
                    stage=stage,
                )
                self.store.append_event(
                    _event(
                        run.run_id,
                        EventType.AGENT_INVOKED,
                        {
                            "stage": stage,
                            "turn_id": turn.turn_id,
                            "session_id": session_id,
                        },
                    )
                )
                response = adapter.invoke(turn.input)
                self.store.append_event(
                    _event(
                        run.run_id,
                        EventType.AGENT_RESPONDED,
                        {
                            "stage": stage,
                            "turn_id": turn.turn_id,
                            "session_id": session_id,
                            "success": True,
                            "response_fingerprint": fingerprint_value(
                                self._fingerprint_key,
                                response,
                                value_type="agent_response",
                            ),
                        },
                    )
                )

            persisted = self.store.list_events(run.run_id, limit=100)
            trace_events = [_execution_event(event) for event in persisted]
            judge_result, findings = judge_r4_events(
                run.run_id, "tc_pipi_001", trace_events
            )
            report = build_report(run.run_id, run.agent_id, trace_events, findings)
            terminal_events = [
                _event(
                    run.run_id,
                    EventType.JUDGE_DECISION,
                    {
                        "verdict": judge_result.verdict,
                        "rule_types": [
                            rule
                            for finding in findings
                            for rule in finding.rule_types
                        ],
                    },
                ),
                *[
                    _event(
                        run.run_id,
                        EventType.FINDING_CREATED,
                        {
                            "finding_id": finding.finding_id,
                            "severity": finding.severity,
                            "rule_types": finding.rule_types,
                        },
                    )
                    for finding in findings
                ],
                _event(
                    run.run_id,
                    EventType.RUN_FINISHED,
                    {"status": "completed", "report_available": True},
                ),
            ]
            self.store.complete_run(
                run.run_id,
                judge_result=judge_result,
                report=report,
                events=terminal_events,
            )
        except PreflightError as exc:
            self.store.fail_running_run(
                run.run_id,
                code=exc.code,
                message="Evaluation context could not be rebuilt.",
                retryable=False,
                stage=stage,
            )
        except Exception:  # noqa: BLE001 - infrastructure failures must become terminal run state
            self.store.fail_running_run(
                run.run_id,
                code="EVALUATION_EXECUTION_FAILED",
                message="Evaluation infrastructure failed.",
                retryable=True,
                stage=stage,
            )

    @staticmethod
    def _load_test_case(test_case_id: str) -> TestCase:
        raw_cases = json.loads(_TEST_CASES_PATH.read_text(encoding="utf-8"))
        raw = next(item for item in raw_cases if item["id"] == test_case_id)
        return TestCase.model_validate(raw)

    def get_report(self, run_id: str):
        self.get(run_id)
        report = self.store.get_report(run_id)
        if report is None:
            raise ReportNotReadyError(run_id)
        return report

    def get_trace(self, run_id: str) -> ExecutionTrace:
        run = self.get(run_id)
        events = [
            _execution_event(event)
            for event in self.store.list_events(run_id, limit=100)
        ]
        return ExecutionTrace(
            trace_id=f"trace-{run_id}",
            run_id=run_id,
            agent_id=run.agent_id,
            events=events,
        )

    def list_events(
        self, run_id: str, *, after_seq: int = 0
    ) -> list[StoredExecutionEvent]:
        self.get(run_id)
        return self.store.list_events(run_id, after_seq=after_seq, limit=100)

    def validate_cursor(self, run_id: str, cursor: str | None, after: int) -> int:
        run = self.get(run_id)
        if after < 0 or after > run.last_event_seq:
            raise InvalidEventCursorError
        if cursor is None:
            return after
        parts = cursor.rsplit(":", 1)
        if len(parts) != 2 or parts[0] != run_id:
            raise InvalidEventCursorError
        try:
            sequence = int(parts[1])
        except ValueError as exc:
            raise InvalidEventCursorError from exc
        if sequence < 0 or sequence > run.last_event_seq:
            raise InvalidEventCursorError
        return max(after, sequence)

    @staticmethod
    def is_terminal(run: EvaluationRun) -> bool:
        return run.status in _TERMINAL_STATUSES

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            if not self.process_queued_once():
                self._wake.wait(0.25)
                self._wake.clear()

    def close(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._worker is not None:
            self._worker.join(timeout=5)
        self.store.close()


_coordinator: EvaluationCoordinator | None = None


def configure(
    *,
    database_path: str | Path,
    fingerprint_key: str,
    start_worker: bool,
) -> EvaluationCoordinator:
    global _coordinator
    if _coordinator is not None:
        _coordinator.close()
    _coordinator = EvaluationCoordinator(
        database_path=database_path,
        fingerprint_key=fingerprint_key,
        start_worker=start_worker,
    )
    return _coordinator


def coordinator() -> EvaluationCoordinator:
    if _coordinator is None:
        raise RuntimeError("Evaluation service has not been configured")
    return _coordinator


def process_queued_once() -> bool:
    return coordinator().process_queued_once()


def shutdown() -> None:
    global _coordinator
    if _coordinator is not None:
        _coordinator.close()
        _coordinator = None


__all__ = [
    "EvaluationNotFoundError",
    "EvaluationNotStartableError",
    "IdempotencyConflictError",
    "InvalidEventCursorError",
    "InvalidTestCaseSelectionError",
    "ReportNotReadyError",
    "configure",
    "coordinator",
    "process_queued_once",
    "shutdown",
]
