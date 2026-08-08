from __future__ import annotations

import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest

from backend.app.domain.enums import EventType
from backend.app.domain.evaluation_report import EvaluationReport
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.execution_event import ExecutionEvent
from backend.app.domain.judge_result import JudgeResult
from backend.app.persistence.sqlite_store import (
    IdempotencyConflictError,
    SQLiteEvaluationStore,
)

NOW = datetime(2026, 8, 8, tzinfo=timezone.utc)


def make_run(run_id: str, *, status: str = "ready") -> EvaluationRun:
    return EvaluationRun.model_validate(
        {
            "run_id": run_id,
            "agent_id": "corpmate-v0",
            "test_case_ids": ["tc_pipi_001"],
            "status": status,
            "created_at": NOW,
            "started_at": None,
            "finished_at": None,
            "current_stage": "web_content_injection",
            "last_event_seq": 0,
            "report_available": False,
            "error": None,
        }
    )


def make_event(run_id: str, index: int, event_type: EventType = EventType.TEST_STARTED) -> ExecutionEvent:
    return ExecutionEvent(
        event_id=f"evt-{run_id}-{index}",
        run_id=run_id,
        timestamp=NOW,
        type=event_type,
        payload={"index": index},
    )


@pytest.fixture
def store(tmp_path):
    value = SQLiteEvaluationStore(tmp_path / "evaluations.sqlite3")
    yield value
    value.close()


def test_initializes_wal_foreign_keys_busy_timeout_and_four_tables(store) -> None:
    diagnostics = store.connection_diagnostics()
    assert diagnostics["journal_mode"] == "wal"
    assert diagnostics["foreign_keys"] == 1
    assert diagnostics["busy_timeout"] == 5_000
    assert {"runs", "events", "judge_results", "reports"}.issubset(
        set(diagnostics["tables"])
    )


def test_create_run_is_idempotent_and_rejects_same_key_with_different_body(store) -> None:
    first = store.create_run(make_run("run-first"), request_id="request-1")
    repeated = store.create_run(make_run("run-retry"), request_id="request-1")

    assert first.created is True
    assert repeated.created is False
    assert repeated.run.run_id == "run-first"

    changed = make_run("run-conflict")
    changed.test_case_ids = ["tc_other"]
    with pytest.raises(IdempotencyConflictError):
        store.create_run(changed, request_id="request-1")


def test_append_event_allocates_unique_monotonic_sequence_under_concurrency(store) -> None:
    run_id = "run-events"
    store.create_run(make_run(run_id), request_id="request-events")

    with ThreadPoolExecutor(max_workers=8) as pool:
        stored = list(pool.map(lambda i: store.append_event(make_event(run_id, i)), range(40)))

    assert sorted(event.seq for event in stored) == list(range(1, 41))
    replay = store.list_events(run_id, after_seq=10, limit=100)
    assert [event.seq for event in replay] == list(range(11, 41))
    assert store.get_run(run_id).last_event_seq == 40


def test_ready_to_queued_and_claim_are_atomic(store) -> None:
    run_id = "run-queue"
    store.create_run(make_run(run_id), request_id="request-queue")

    with ThreadPoolExecutor(max_workers=2) as pool:
        queued_results = list(pool.map(lambda _: store.queue_run(run_id), range(2)))
    assert sorted(queued_results) == [False, True]

    with ThreadPoolExecutor(max_workers=2) as pool:
        claimed = list(pool.map(lambda _: store.claim_next_queued(), range(2)))
    claimed_runs = [run for run in claimed if run is not None]
    assert len(claimed_runs) == 1
    assert claimed_runs[0].run_id == run_id
    assert claimed_runs[0].status == "running"
    assert claimed_runs[0].started_at is not None


def test_restart_interrupts_running_run_and_appends_terminal_events_atomically(store) -> None:
    run_id = "run-restart"
    store.create_run(make_run(run_id), request_id="request-restart")
    assert store.queue_run(run_id)
    assert store.claim_next_queued() is not None

    recovered = store.interrupt_running_runs()

    assert recovered == [run_id]
    run = store.get_run(run_id)
    assert run.status == "interrupted"
    assert run.finished_at is not None
    assert run.error is not None
    assert run.error.code == "PROCESS_RESTARTED"
    events = store.list_events(run_id)
    assert [event.type for event in events] == [EventType.RUN_STARTED, EventType.RUN_FAILED, EventType.RUN_FINISHED]
    assert events[0].payload["agent_id"] == "corpmate-v0"
    assert events[1].payload["error_code"] == "PROCESS_RESTARTED"
    assert events[2].payload["status"] == "interrupted"
    assert run.last_event_seq == 3

    assert store.interrupt_running_runs() == []
    assert len(store.list_events(run_id)) == 3


def test_restart_interrupts_preflight_run(store) -> None:
    run_id = "run-preflight-restart"
    store.create_run(make_run(run_id, status="preflighting"), request_id="request-preflight-restart")

    assert store.interrupt_preflighting_runs() == [run_id]
    run = store.get_run(run_id)
    assert run.status == "interrupted"
    assert run.error is not None
    assert run.error.code == "PROCESS_RESTARTED"
    assert [event.type for event in store.list_events(run_id)] == [EventType.RUN_FAILED, EventType.RUN_FINISHED]


def test_judge_result_and_report_round_trip_through_their_tables(store) -> None:
    run_id = "run-artifacts"
    store.create_run(make_run(run_id), request_id="request-artifacts")
    judge = JudgeResult(
        judge_id="judge-1",
        test_case_id="tc_pipi_001",
        verdict="PASS",
        violations=[],
        evidence=[],
        judged_at=NOW,
    )
    report = EvaluationReport.model_validate(
        {
            "report_id": "report-1",
            "evaluation_id": run_id,
            "agent_id": "corpmate-v0",
            "overall_score": 100,
            "severity": "LOW",
            "findings": [],
            "conclusion": "No complete R4 chain detected.",
            "score_breakdown": {
                "algorithm_version": "r4-mvp-v1",
                "dimensions": {
                    "capability": 100,
                    "execution_stability": 100,
                    "security": 100,
                },
                "weights": {
                    "capability": 25,
                    "execution_stability": 20,
                    "security": 55,
                },
                "deductions": [],
                "severity_cap": None,
            },
            "created_at": NOW,
        }
    )

    store.save_judge_result(run_id, judge)
    store.save_report(run_id, report)

    assert store.get_judge_result(run_id) == judge
    assert store.get_report(run_id) == report
    assert store.get_run(run_id).report_available is True


def test_database_enforces_event_run_foreign_key(store) -> None:
    with pytest.raises(sqlite3.IntegrityError):
        store.append_event(make_event("missing-run", 1))
