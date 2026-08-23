"""Persistent evaluation coordination for the R4 MVP vertical slice."""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from backend.app.adapter.reference_adapter import ReferenceAgentAdapter
from backend.app.domain.enums import EventType
from backend.app.domain.evaluation_comparison import (
    EvaluationComparison,
    compare_case_results,
    summarize_comparison,
)
from backend.app.domain.evaluation_report import ReportSummary
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.execution_event import ExecutionEvent
from backend.app.domain.execution_trace import ExecutionTrace
from backend.app.domain.judge_result import JudgeResult
from backend.app.domain.risk_finding import FindingEvidence, RiskFinding
from backend.app.domain.test_case import TestCase
from backend.app.domain.test_scenario import ScenarioTurn
from backend.app.judge.composite_judge import CompositeJudge
from backend.app.judge.r4_judge import judge_r4_events
from backend.app.knowledge.kb_loader import load_all_test_case_files
from backend.app.persistence.sqlite_store import (
    IdempotencyConflictError,
    SQLiteEvaluationStore,
    StoredExecutionEvent,
)
from backend.app.sandbox.composite import CompositeSandbox
from backend.app.security.fingerprints import derive_canary, fingerprint_value
from backend.app.services import agent_service
from backend.app.services.preflight_service import PreflightError, PreflightService
from backend.app.services.report_service import build_report


class EvaluationNotFoundError(LookupError):
    pass


class InvalidTestCaseSelectionError(ValueError):
    pass


class InvalidAgentSelectionError(ValueError):
    pass


class EvaluationNotStartableError(RuntimeError):
    pass


class ReportNotReadyError(RuntimeError):
    pass


class InvalidEventCursorError(ValueError):
    pass


class ComparisonNotFoundError(LookupError):
    pass


class ComparisonNotStartableError(RuntimeError):
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
        self._comparison_advance_lock = threading.Lock()
        self._comparison_executor = ThreadPoolExecutor(
            max_workers=4,
            thread_name_prefix="evaluation-comparison",
        )
        self._comparison_futures: dict[str, set[Future[None]]] = {}
        self._comparison_futures_lock = threading.Lock()
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
        known_ids = {raw["id"] for raw in load_all_test_case_files()}
        unknown = [tid for tid in test_case_ids if tid not in known_ids]
        if unknown:
            raise InvalidTestCaseSelectionError
        existing = self.store.get_run_by_request_id(request_id)
        if existing is not None:
            if (
                existing.agent_id != agent_id
                or existing.test_case_ids != test_case_ids
            ):
                raise IdempotencyConflictError(
                    "idempotency key was already used with a different request body"
                )
            return existing, False
        tool_permissions = self._agent_tool_permissions(agent_id)
        run_id = f"eval-{uuid.uuid4().hex[:16]}"
        run = EvaluationRun(
            run_id=run_id,
            agent_id=agent_id,
            test_case_ids=test_case_ids,
            status="preflighting",
            created_at=datetime.now(timezone.utc),
            current_stage="web_content_injection" if test_case_ids == ["tc_pipi_001"] else None,
        )
        created = self.store.create_run(
            run,
            request_id=request_id,
            fingerprint_key_id=self._key_id,
        )
        if not created.created:
            return created.run, False

        if test_case_ids != ["tc_pipi_001"]:
            # D10: 通用场景无 seeded fixture/canary, 直接 ready; 执行时按 initial_state + env_delta 构建.
            return (
                self.store.mark_ready(
                    run_id,
                    _event(
                        run_id,
                        EventType.PREFLIGHT_COMPLETED,
                        {
                            "stage": "scenario_initial_state",
                            "test_case_ids": test_case_ids,
                        },
                    ),
                ),
                True,
            )

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
                tool_permissions=tool_permissions,
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
            self._advance_comparisons()
            return True
        finally:
            self._process_lock.release()

    def create_comparison(
        self,
        *,
        request_id: str,
        test_case_ids: list[str],
    ) -> tuple[EvaluationComparison, bool]:
        if not test_case_ids:
            raise InvalidTestCaseSelectionError
        known_ids = {raw["id"] for raw in load_all_test_case_files()}
        if any(test_case_id not in known_ids for test_case_id in test_case_ids):
            raise InvalidTestCaseSelectionError
        comparison_seed = f"comparison-seed-{uuid.uuid4().hex[:16]}"
        existing = self.store.get_comparison_by_request_id(request_id)
        if existing is not None:
            if existing.test_case_ids != test_case_ids:
                raise IdempotencyConflictError(
                    "comparison request_id was already used with different request data"
                )
            return existing, False

        comparison_id = f"cmp-{uuid.uuid4().hex[:16]}"
        bare, _ = self.create(
            request_id=f"{request_id}:bare",
            agent_id="llm-agent-v0",
            test_case_ids=test_case_ids,
        )
        defended, _ = self.create(
            request_id=f"{request_id}:defended",
            agent_id="defended-llm-v0",
            test_case_ids=test_case_ids,
        )
        comparison = EvaluationComparison(
            comparison_id=comparison_id,
            mode="bare_vs_defended",
            test_case_ids=test_case_ids,
            bare_run_id=bare.run_id,
            defended_run_id=defended.run_id,
            status="creating",
            comparison_seed=comparison_seed,
            created_at=datetime.now(timezone.utc),
        )
        comparison, created = self.store.create_comparison(
            comparison,
            request_id=request_id,
        )
        if not created:
            return comparison, False
        if bare.status == "ready" and defended.status == "ready":
            comparison = self.store.update_comparison(
                comparison.comparison_id,
                status="queued",
            )
        elif self.is_terminal(bare) or self.is_terminal(defended):
            comparison = self.store.update_comparison(
                comparison.comparison_id,
                status="failed",
            )
        else:
            comparison = self.store.update_comparison(
                comparison.comparison_id,
                status="queued",
            )
        return comparison, True

    def start_comparison(self, comparison_id: str) -> EvaluationComparison:
        comparison = self.get_comparison(comparison_id)
        if comparison.status == "completed":
            return comparison
        if comparison.status in {"running_parallel", "running_bare", "running_defended"}:
            return comparison
        if comparison.status != "queued":
            raise ComparisonNotStartableError(comparison.status)
        if not comparison.defended_run_id:
            raise ComparisonNotStartableError("missing defended run")

        run_ids = [comparison.bare_run_id, comparison.defended_run_id]
        claimed = self.store.claim_ready_runs(run_ids)
        if claimed is None:
            raise ComparisonNotStartableError("both comparison sides must be ready")
        comparison = self.store.update_comparison(
            comparison.comparison_id,
            status="running_parallel",
        )
        self._launch_comparison_runs(comparison.comparison_id, claimed)
        return comparison

    def wait_for_comparison(self, comparison_id: str, *, timeout: float) -> None:
        with self._comparison_futures_lock:
            futures = list(self._comparison_futures.get(comparison_id, set()))
        for future in futures:
            future.result(timeout=timeout)

    def _launch_comparison_runs(
        self,
        comparison_id: str,
        runs: list[EvaluationRun],
    ) -> None:
        with self._comparison_futures_lock:
            futures = self._comparison_futures.setdefault(comparison_id, set())
        for run in runs:
            future = self._comparison_executor.submit(
                self._execute_comparison_side,
                comparison_id,
                run,
            )
            with self._comparison_futures_lock:
                futures.add(future)

            def finished(done: Future[None], *, key=comparison_id) -> None:
                self._advance_comparison(key)
                with self._comparison_futures_lock:
                    active = self._comparison_futures.get(key)
                    if active is not None:
                        active.discard(done)
                        if not active:
                            self._comparison_futures.pop(key, None)

            future.add_done_callback(finished)

    def _execute_comparison_side(
        self,
        comparison_id: str,
        run: EvaluationRun,
    ) -> None:
        self._execute(run)
        self._advance_comparison(comparison_id)

    def get_comparison(self, comparison_id: str) -> EvaluationComparison:
        comparison = self.store.get_comparison(comparison_id)
        if comparison is None:
            raise ComparisonNotFoundError(comparison_id)
        return comparison

    def comparison_snapshot(self, comparison_id: str) -> dict:
        comparison = self.get_comparison(comparison_id)
        bare = self.get(comparison.bare_run_id)
        defended = self.get(comparison.defended_run_id) if comparison.defended_run_id else None
        return {
            **comparison.model_dump(mode="json"),
            "bare_run": bare.model_dump(mode="json"),
            "defended_run": defended.model_dump(mode="json") if defended else None,
        }

    def comparison_report(self, comparison_id: str) -> dict:
        comparison = self.get_comparison(comparison_id)
        if comparison.status != "completed":
            raise ReportNotReadyError(comparison.status)
        bare = self.get(comparison.bare_run_id)
        defended = self.get(comparison.defended_run_id) if comparison.defended_run_id else None
        bare_results = self._comparison_case_results(bare.run_id, comparison.test_case_ids)
        defended_results = self._comparison_case_results(defended.run_id, comparison.test_case_ids) if defended else []
        results = compare_case_results(
            bare_results,
            defended_results,
            comparison.test_case_ids,
        )
        return {
            "comparison_id": comparison.comparison_id,
            "mode": comparison.mode,
            "test_case_ids": comparison.test_case_ids,
            "status": comparison.status,
            "bare_run_id": bare.run_id,
            "defended_run_id": defended.run_id if defended else None,
            "summary": summarize_comparison(results).model_dump(mode="json"),
            "results": [result.model_dump(mode="json") for result in results],
        }

    def list_comparison_events(self, comparison_id: str, *, after: int = 0) -> list[dict]:
        comparison = self.get_comparison(comparison_id)
        events: list[tuple[datetime, str, StoredExecutionEvent]] = []
        for side, run_id in (("bare", comparison.bare_run_id), ("defended", comparison.defended_run_id)):
            if not run_id:
                continue
            for event in self.store.list_events(run_id, limit=1000):
                events.append((event.timestamp, side, event))
        events.sort(key=lambda item: (item[0], item[2].run_id, item[2].seq))
        return [
            {
                "seq": index,
                "side": side,
                "run_seq": event.seq,
                "event": event.model_dump(mode="json", exclude={"seq"}),
            }
            for index, (_, side, event) in enumerate(events, start=1)
            if index > after
        ]

    def retry_comparison(self, comparison_id: str, side: str) -> EvaluationComparison:
        comparison = self.get_comparison(comparison_id)
        if side not in {"bare", "defended"}:
            raise ComparisonNotStartableError(side)
        old_run_id = comparison.bare_run_id if side == "bare" else comparison.defended_run_id
        if not old_run_id:
            raise ComparisonNotStartableError("missing child run")
        old_run = self.get(old_run_id)
        if not self.is_terminal(old_run) or old_run.status == "completed":
            raise ComparisonNotStartableError(old_run.status)
        agent_id = "llm-agent-v0" if side == "bare" else "defended-llm-v0"
        run, _ = self.create(
            request_id=f"{comparison.comparison_id}:{side}:{uuid.uuid4().hex}",
            agent_id=agent_id,
            test_case_ids=comparison.test_case_ids,
        )
        if run.status != "ready":
            raise ComparisonNotStartableError(run.status)
        claimed = self.store.claim_ready_runs([run.run_id])
        if claimed is None:
            raise ComparisonNotStartableError("retry side is no longer ready")
        if side == "bare":
            updated = self.store.update_comparison(
                comparison.comparison_id,
                status="running_parallel",
                bare_run_id=run.run_id,
                defended_run_id=comparison.defended_run_id,
            )
        else:
            updated = self.store.update_comparison(
                comparison.comparison_id,
                status="running_parallel",
                defended_run_id=run.run_id,
            )
        self._launch_comparison_runs(comparison.comparison_id, claimed)
        return updated

    def _advance_comparisons(self) -> None:
        for comparison in self.store.list_active_comparisons():
            self._advance_comparison(comparison.comparison_id)

    def _advance_comparison(self, comparison_id: str) -> None:
        with self._comparison_advance_lock:
            comparison = self.get_comparison(comparison_id)
            bare = self.get(comparison.bare_run_id)
            defended = (
                self.get(comparison.defended_run_id)
                if comparison.defended_run_id
                else None
            )
            if comparison.status == "running_parallel":
                if defended and self.is_terminal(bare) and self.is_terminal(defended):
                    self.store.update_comparison(
                        comparison.comparison_id,
                        status=(
                            "completed"
                            if bare.status == "completed"
                            and defended.status == "completed"
                            else "partial"
                            if bare.status == "completed"
                            or defended.status == "completed"
                            else "failed"
                        ),
                    )
                return

            if comparison.status in {"creating", "queued", "running_bare"} and self.is_terminal(bare):
                if bare.status == "completed" and defended and defended.status == "ready":
                    self.start(defended.run_id)
                    self.store.update_comparison(
                        comparison.comparison_id,
                        status="running_defended",
                    )
                elif defended and self.is_terminal(defended):
                    self.store.update_comparison(
                        comparison.comparison_id,
                        status=(
                            "completed"
                            if bare.status == "completed" and defended.status == "completed"
                            else "partial"
                        ),
                    )
                else:
                    self.store.update_comparison(
                        comparison.comparison_id,
                        status="failed",
                    )
                return
            if comparison.status == "running_defended" and defended and self.is_terminal(defended):
                self.store.update_comparison(
                    comparison.comparison_id,
                    status="completed"
                    if bare.status == "completed" and defended.status == "completed"
                    else "partial",
                )

    def _comparison_case_results(self, run_id: str, test_case_ids: list[str]) -> list[dict]:
        results: dict[str, dict] = {}
        findings: dict[str, list[dict[str, object]]] = {}
        fallback_verdict: str | None = None
        for event in self.store.list_events(run_id, limit=1000):
            test_case_id = event.payload.get("test_case_id")
            verdict = event.payload.get("verdict")
            if event.type == EventType.TEST_COMPLETED and isinstance(test_case_id, str):
                results[test_case_id] = {
                    "test_case_id": test_case_id,
                    "verdict": verdict,
                    "findings": findings.get(test_case_id, []),
                }
            elif event.type == EventType.FINDING_CREATED and isinstance(test_case_id, str):
                findings.setdefault(test_case_id, []).append(
                    {
                        "finding_id": event.payload.get("finding_id"),
                        "severity": event.payload.get("severity"),
                        "description": event.payload.get("description"),
                        "rule_types": event.payload.get("rule_types", []),
                        "evidence_count": event.payload.get("evidence_count", 0),
                    }
                )
            elif event.type == EventType.JUDGE_DECISION and isinstance(verdict, str):
                fallback_verdict = verdict
        for test_case_id, result in results.items():
            result["findings"] = findings.get(test_case_id, [])
        if not results and fallback_verdict is not None and test_case_ids:
            results[test_case_ids[0]] = {
                "test_case_id": test_case_ids[0],
                "verdict": fallback_verdict,
                "findings": findings.get(test_case_ids[0], []),
            }
        return list(results.values())

    def _execute(self, run: EvaluationRun) -> None:
        if run.test_case_ids != ["tc_pipi_001"]:
            self._execute_generic(run)
            return
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
            tool_permissions = self._agent_tool_permissions(run.agent_id)

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
                    tool_permissions=tool_permissions,
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
            agent = self._create_agent(run.agent_id, sandbox)
            adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=agent)
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
                if turn.env_delta:
                    sandbox.apply_delta(turn.env_delta)
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

            persisted = self.store.list_events(run.run_id, limit=1000)
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
                            "test_case_id": "tc_pipi_001",
                            "severity": finding.severity,
                            "description": finding.description,
                            "rule_types": finding.rule_types,
                            "evidence_count": len(finding.evidence),
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

    def _execute_generic(self, run: EvaluationRun) -> None:
        """D10+D11+L5+D13: 通用多 TestCase 执行路径.

        CompositeJudge (Rule + LLM Mock), TEST_COMPLETED 事件, ReportSummary 统计.
        与 R4 垂直切片路径并存: R4 (tc_pipi_001) 保留原 preflight/canary/judge_r4 链路,
        其余任意 TestCase 走本路径, 每条 TestCase 独立 reset + 判定.
        """
        test_cases: list[TestCase] = []
        all_findings: list[RiskFinding] = []
        last_judge: JudgeResult | None = None
        tc_results: list[dict] = []
        try:
            test_cases = self._load_test_cases(run.test_case_ids)
            canary = derive_canary(self._fingerprint_key, run.run_id)
            tool_permissions = self._agent_tool_permissions(run.agent_id)

            def sink(event_type: str, payload: dict) -> str:
                return self.store.append_event(
                    _event(run.run_id, EventType(event_type), payload)
                ).event_id

            sandbox = CompositeSandbox(
                event_sink=sink,
                fingerprint_value=lambda value_type, value: fingerprint_value(
                    self._fingerprint_key, value, value_type=value_type
                ),
                canary=canary,
                canary_fingerprint="",
                enforce_email_confirmation=tool_permissions.get("email.send") == "CONFIRM",
                tool_permissions=tool_permissions,
            )
            agent = self._create_agent(run.agent_id, sandbox)
            adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=agent)
            composite_judge = self._create_judge(run.agent_id)
            for test_case in test_cases:
                turns = self._resolve_turns(test_case)
                total_turns = len(turns)
                self.store.append_event(
                    _event(
                        run.run_id,
                        EventType.TEST_STARTED,
                        {
                            "test_case_id": test_case.id,
                            "turn_index": 0,
                            "total_turns": total_turns,
                        },
                    )
                )
                # 每条 TestCase 独立: 清空 agent/sandbox/recorder, 再按 scenario.initial_state 重建
                adapter.reset()
                sandbox.reset(test_case.scenario.initial_state.model_dump())

                for index, turn in enumerate(turns):
                    session_id = f"{run.run_id}-{test_case.id}-session-{index + 1}"
                    if turn.starts_new_session:
                        adapter.begin_new_session()
                    if turn.env_delta:
                        adapter.apply_env_delta(turn.env_delta)
                    sandbox.set_execution_context(
                        turn_id=turn.turn_id,
                        session_id=session_id,
                        stage=turn.turn_id,
                    )
                    self.store.append_event(
                        _event(
                            run.run_id,
                            EventType.AGENT_INVOKED,
                            {
                                "test_case_id": test_case.id,
                                "turn_index": index,
                                "total_turns": total_turns,
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
                                "test_case_id": test_case.id,
                                "turn_index": index,
                                "total_turns": total_turns,
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

                # D11: CompositeJudge (Rule + LLM Mock)
                judge_result = composite_judge.evaluate(
                    adapter.get_trace(), test_case, tool_permissions=tool_permissions
                )
                last_judge = judge_result
                findings = self._findings_from_judge(run.run_id, test_case, judge_result)
                all_findings.extend(findings)
                self.store.append_event(
                    _event(
                        run.run_id,
                        EventType.JUDGE_DECISION,
                        {
                            "test_case_id": test_case.id,
                            "verdict": judge_result.verdict,
                            "rule_types": [v.rule_type for v in judge_result.violations],
                        },
                    )
                )
                for finding in findings:
                    self.store.append_event(
                        _event(
                            run.run_id,
                            EventType.FINDING_CREATED,
                            {
                                "finding_id": finding.finding_id,
                                "test_case_id": test_case.id,
                                "severity": finding.severity,
                                "description": finding.description,
                                "rule_types": finding.rule_types,
                                "evidence_count": len(finding.evidence),
                            },
                        )
                    )

                # L5: TEST_COMPLETED 事件
                self.store.append_event(
                    _event(
                        run.run_id,
                        EventType.TEST_COMPLETED,
                        {
                            "test_case_id": test_case.id,
                            "verdict": judge_result.verdict,
                            "evidence_count": len(judge_result.evidence),
                            "rule_id": judge_result.violations[0].rule_type if judge_result.violations else None,
                        },
                    )
                )

                # D13: 记录每条结果用于统计
                # 优先从 tags 提取 risk_pattern (精确), fallback 到 risk_type 映射 (宽泛)
                _TAG_TO_PATTERN = {"r1": "R1", "r2": "R2", "r3": "R3", "r4": "R4"}
                _RISK_TYPE_TO_PATTERN = {
                    "indirect_prompt_injection": "R1",
                    "memory_poisoning": "R2",
                    "privacy_leakage": "R3",
                    "persistent_indirect_prompt_injection": "R4",
                }
                risk_pattern = next(
                    (_TAG_TO_PATTERN[t] for t in test_case.tags if t in _TAG_TO_PATTERN),
                    _RISK_TYPE_TO_PATTERN.get(test_case.risk_type, "OTHER"),
                )
                tc_results.append({
                    "test_case_id": test_case.id,
                    "verdict": judge_result.verdict,
                    "risk_type": test_case.risk_type,
                    "severity": test_case.severity,
                    "risk_pattern": risk_pattern,
                })

            # D13: 计算 ReportSummary
            summary = self._compute_summary(tc_results)

            # D12: limit 100 → 1000 (防止多 TestCase 多轮事件截断)
            persisted = self.store.list_events(run.run_id, limit=1000)
            trace_events = [_execution_event(event) for event in persisted]
            report = build_report(
                run.run_id, run.agent_id, trace_events, all_findings, summary=summary
            )
            terminal_events = [
                _event(
                    run.run_id,
                    EventType.RUN_FINISHED,
                    {"status": "completed", "report_available": True},
                )
            ]
            self.store.complete_run(
                run.run_id,
                judge_result=last_judge,
                report=report,
                events=terminal_events,
            )
        except Exception:  # noqa: BLE001 - each selected case still receives a terminal outcome
            if not test_cases:
                self.store.fail_running_run(
                    run.run_id,
                    code="EVALUATION_EXECUTION_FAILED",
                    message="Evaluation infrastructure failed.",
                    retryable=True,
                    stage="generic_execution",
                )
                return

            completed_ids = {result["test_case_id"] for result in tc_results}
            for test_case in test_cases:
                if test_case.id in completed_ids:
                    continue
                self.store.append_event(
                    _event(
                        run.run_id,
                        EventType.TEST_COMPLETED,
                        {
                            "test_case_id": test_case.id,
                            "verdict": "ERROR",
                            "evidence_count": 0,
                            "rule_id": None,
                        },
                    )
                )
                risk_pattern = {
                    "indirect_prompt_injection": "R1",
                    "memory_poisoning": "R2",
                    "privacy_leakage": "R3",
                    "persistent_indirect_prompt_injection": "R4",
                }.get(test_case.risk_type, "OTHER")
                tc_results.append({
                    "test_case_id": test_case.id,
                    "verdict": "ERROR",
                    "risk_type": test_case.risk_type,
                    "severity": test_case.severity,
                    "risk_pattern": risk_pattern,
                })

            summary = self._compute_summary(tc_results)
            persisted = self.store.list_events(run.run_id, limit=1000)
            report = build_report(
                run.run_id,
                run.agent_id,
                [_execution_event(event) for event in persisted],
                all_findings,
                summary=summary,
            )
            self.store.complete_run(
                run.run_id,
                judge_result=last_judge,
                report=report,
                events=[
                    _event(
                        run.run_id,
                        EventType.RUN_FINISHED,
                        {"status": "completed", "report_available": True, "degraded": True},
                    )
                ],
            )

    @staticmethod
    def _compute_summary(tc_results: list[dict]) -> ReportSummary:
        """D13: 从每条 TestCase 结果计算批量统计摘要."""
        from collections import defaultdict
        total = len(tc_results)
        passed = sum(1 for r in tc_results if r["verdict"] == "PASS")
        failed = sum(1 for r in tc_results if r["verdict"] == "FAIL")
        error = sum(1 for r in tc_results if r["verdict"] == "ERROR")
        pass_rate = passed / total if total > 0 else 0.0

        by_risk_pattern: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "passed": 0, "failed": 0, "error": 0})
        by_risk_type: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "passed": 0, "failed": 0, "error": 0})
        by_severity: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "passed": 0, "failed": 0, "error": 0})

        _verdict_key = {"PASS": "passed", "FAIL": "failed", "ERROR": "error"}
        for r in tc_results:
            v = _verdict_key.get(r["verdict"], "error")
            by_risk_pattern[r["risk_pattern"]]["total"] += 1
            by_risk_pattern[r["risk_pattern"]][v] += 1
            by_risk_type[r["risk_type"]]["total"] += 1
            by_risk_type[r["risk_type"]][v] += 1
            by_severity[r["severity"]]["total"] += 1
            by_severity[r["severity"]][v] += 1

        return ReportSummary(
            total_tests=total,
            passed=passed,
            failed=failed,
            error=error,
            pass_rate=round(pass_rate, 4),
            by_risk_pattern=dict(by_risk_pattern),
            by_risk_type=dict(by_risk_type),
            by_severity=dict(by_severity),
        )

    @staticmethod
    def _resolve_turns(test_case: TestCase) -> list[ScenarioTurn]:
        """turns 非空优先, 否则顶层 input 包装单轮 (与 Runner._resolve_turns 一致)."""
        if test_case.scenario and test_case.scenario.turns:
            return test_case.scenario.turns
        return [
            ScenarioTurn(
                turn_id="single",
                input=test_case.input or "",
                starts_new_session=True,
            )
        ]

    @staticmethod
    def _agent_tool_permissions(agent_id: str) -> dict[str, str]:
        """Resolve the selected Agent's manifest before a run is persisted."""
        # All known Stage 3 agents share the same CorpMate tool permissions
        _KNOWN_AGENTS = {"corpmate-v0", "llm-agent-v0", "defended-llm-v0"}
        if agent_id in _KNOWN_AGENTS:
            return {
                "browser.open_page": "ALLOW",
                "email.list": "ALLOW",
                "email.read": "ALLOW",
                "email.send": "CONFIRM",
                "memory.read": "ALLOW",
                "memory.write": "ALLOW",
            }
        profile = agent_service.get_agent(agent_id)
        if profile is not None:
            return dict(profile.manifest.tool_permissions)
        raise InvalidAgentSelectionError(agent_id)

    @staticmethod
    def _create_agent(agent_id: str, sandbox: CompositeSandbox):
        """Factory: create agent instance by agent_id.

        Known agents get their specific implementation.
        Custom registered agents fall back to CorpMate (keyword-based).
        """
        if agent_id == "corpmate-v0":
            from backend.app.corpmate.agent import CorpMate

            return CorpMate(sandbox=sandbox)
        if agent_id == "llm-agent-v0":
            from backend.app.agents.llm_agent import LLMAgent
            from backend.app.llm.client import LLMClient

            return LLMAgent(sandbox=sandbox, llm_client=LLMClient())
        if agent_id == "defended-llm-v0":
            from backend.app.agents.defended_llm_agent import DefendedLLMAgent
            from backend.app.llm.client import LLMClient

            return DefendedLLMAgent(sandbox=sandbox, llm_client=LLMClient())
        # Fallback: custom registered agents use CorpMate implementation
        profile = agent_service.get_agent(agent_id)
        if profile is not None:
            from backend.app.corpmate.agent import CorpMate

            return CorpMate(sandbox=sandbox)
        raise InvalidAgentSelectionError(agent_id)

    @staticmethod
    def _create_judge(agent_id: str) -> CompositeJudge:
        """Factory: create CompositeJudge with appropriate LLM judge.

        defended-llm-v0 uses real LLMJudge for semantic evaluation.
        All other agents use MockLLMJudge (Rule Judge only).
        """
        if agent_id == "defended-llm-v0":
            from backend.app.judge.llm_judge import LLMJudge
            from backend.app.llm.client import LLMClient

            return CompositeJudge(llm_judge=LLMJudge(llm_client=LLMClient()))
        return CompositeJudge()

    @classmethod
    def _load_test_cases(cls, test_case_ids: list[str]) -> list[TestCase]:
        by_id = {raw["id"]: raw for raw in load_all_test_case_files()}
        return [TestCase.model_validate(by_id[tid]) for tid in test_case_ids]

    @staticmethod
    def _findings_from_judge(
        run_id: str,
        test_case: TestCase,
        judge_result: JudgeResult,
    ) -> list[RiskFinding]:
        """RuleJudge violations -> RiskFinding (risk_pattern_id 从 tags 取 R1-R4)."""
        risk_pattern_id = ""
        for tag in test_case.tags:
            if len(tag) == 2 and tag[0].lower() == "r" and tag[1].isdigit():
                risk_pattern_id = tag.upper()
                break
        findings: list[RiskFinding] = []
        for violation in judge_result.violations:
            findings.append(
                RiskFinding(
                    finding_id=f"finding-{uuid.uuid4().hex[:12]}",
                    evaluation_id=run_id,
                    risk_type=test_case.risk_type,
                    severity=test_case.severity,
                    risk_pattern_id=risk_pattern_id or "UNKNOWN",
                    description=violation.description,
                    evidence=[
                        FindingEvidence(event_id=eid, description="RuleJudge evidence")
                        for eid in violation.evidence_event_ids
                    ],
                    rule_types=[violation.rule_type],
                    remediation="Review agent tool permissions and enforce confirmation for sensitive tools.",
                )
            )
        return findings
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
            for event in self.store.list_events(run_id, limit=1000)
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
        return self.store.list_events(run_id, after_seq=after_seq, limit=1000)

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
        self._comparison_executor.shutdown(wait=True, cancel_futures=True)
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
    "InvalidAgentSelectionError",
    "InvalidEventCursorError",
    "InvalidTestCaseSelectionError",
    "ReportNotReadyError",
    "configure",
    "coordinator",
    "process_queued_once",
    "shutdown",
]
