from __future__ import annotations

import json
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Self
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from backend.app.domain.enums import EventType
from backend.app.domain.evaluation_comparison import EvaluationComparison
from backend.app.domain.evaluation_report import EvaluationReport
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.execution_event import ExecutionEvent
from backend.app.domain.judge_result import JudgeResult
from backend.app.services.preflight_service import PreflightMetadata

_RUN_STATUSES = (
    "preflighting",
    "ready",
    "preflight_failed",
    "queued",
    "running",
    "completed",
    "failed",
    "interrupted",
)


class IdempotencyConflictError(RuntimeError):
    """The idempotency key already belongs to a different request body."""


class StoredExecutionEvent(BaseModel):
    model_config = ConfigDict(frozen=True)

    event_id: str
    run_id: str
    seq: int = Field(..., ge=1)
    timestamp: datetime
    type: EventType
    payload: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True)
class CreateRunResult:
    run: EvaluationRun
    created: bool


@dataclass(frozen=True)
class RunContext:
    seed_id: str
    fixture_id: str
    target_url: str
    mutation_version: str
    fixture_digest: str


class SQLiteEvaluationStore:
    """SQLite-backed run store with transactionally ordered event streams."""

    def __init__(self, database_path: str | Path, *, busy_timeout_ms: int = 5_000) -> None:
        path = Path(database_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self._database_path = str(path)
        self._busy_timeout_ms = busy_timeout_ms
        self._local = threading.local()
        self._connections: set[sqlite3.Connection] = set()
        self._connections_lock = threading.Lock()
        self._closed = False
        self._initialize_schema()

    def _connect(self) -> sqlite3.Connection:
        if self._closed:
            raise RuntimeError("SQLiteEvaluationStore is closed")
        connection = sqlite3.connect(
            self._database_path,
            timeout=self._busy_timeout_ms / 1_000,
            isolation_level=None,
            check_same_thread=False,
        )
        connection.row_factory = sqlite3.Row
        connection.execute(f"PRAGMA busy_timeout = {self._busy_timeout_ms}")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        with self._connections_lock:
            self._connections.add(connection)
        return connection

    def _connection(self) -> sqlite3.Connection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = self._connect()
            self._local.connection = connection
        return connection

    def _initialize_schema(self) -> None:
        connection = self._connection()
        status_values = ", ".join(f"'{value}'" for value in _RUN_STATUSES)
        connection.executescript(
            f"""
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                request_id TEXT NOT NULL UNIQUE,
                request_body_json TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                test_case_ids_json TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ({status_values})),
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                current_stage TEXT,
                last_event_seq INTEGER NOT NULL DEFAULT 0 CHECK (last_event_seq >= 0),
                report_available INTEGER NOT NULL DEFAULT 0 CHECK (report_available IN (0, 1)),
                error_json TEXT,
                seed_id TEXT,
                fixture_id TEXT,
                target_url TEXT,
                mutation_version TEXT,
                fixture_digest TEXT,
                fingerprint_key_id TEXT
            );

            CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
                seq INTEGER NOT NULL CHECK (seq > 0),
                timestamp TEXT NOT NULL,
                type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                UNIQUE (run_id, seq)
            );
            CREATE INDEX IF NOT EXISTS idx_events_run_seq ON events(run_id, seq);

            CREATE TABLE IF NOT EXISTS judge_results (
                run_id TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
                judge_id TEXT NOT NULL UNIQUE,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reports (
                run_id TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
                report_id TEXT NOT NULL UNIQUE,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS comparisons (
                comparison_id TEXT PRIMARY KEY,
                request_id TEXT NOT NULL UNIQUE,
                request_body_json TEXT NOT NULL,
                mode TEXT NOT NULL,
                test_case_ids_json TEXT NOT NULL,
                bare_run_id TEXT NOT NULL REFERENCES runs(run_id),
                defended_run_id TEXT REFERENCES runs(run_id),
                status TEXT NOT NULL,
                comparison_seed TEXT NOT NULL,
                created_at TEXT NOT NULL,
                bare_agent_id TEXT NOT NULL,
                defended_agent_id TEXT NOT NULL
            );
            """
        )

    @contextmanager
    def _immediate(self) -> Iterator[sqlite3.Connection]:
        connection = self._connection()
        connection.execute("BEGIN IMMEDIATE")
        try:
            yield connection
        except BaseException:
            connection.rollback()
            raise
        else:
            connection.commit()

    @staticmethod
    def _json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    @staticmethod
    def _timestamp(value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def connection_diagnostics(self) -> dict[str, Any]:
        connection = self._connection()
        tables = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        ).fetchall()
        return {
            "journal_mode": connection.execute("PRAGMA journal_mode").fetchone()[0],
            "foreign_keys": connection.execute("PRAGMA foreign_keys").fetchone()[0],
            "busy_timeout": connection.execute("PRAGMA busy_timeout").fetchone()[0],
            "tables": [row["name"] for row in tables],
        }

    def create_run(
        self,
        run: EvaluationRun,
        *,
        request_id: str,
        fingerprint_key_id: str | None = None,
    ) -> CreateRunResult:
        request_body = self._json(
            {"agent_id": run.agent_id, "test_case_ids": run.test_case_ids}
        )
        with self._immediate() as connection:
            existing = connection.execute(
                "SELECT * FROM runs WHERE request_id = ?",
                (request_id,),
            ).fetchone()
            if existing is not None:
                if existing["request_body_json"] != request_body:
                    raise IdempotencyConflictError(
                        "idempotency key was already used with a different request body"
                    )
                return CreateRunResult(run=self._run_from_row(existing), created=False)

            connection.execute(
                """
                INSERT INTO runs (
                    run_id, request_id, request_body_json, agent_id, test_case_ids_json,
                    status, created_at, started_at, finished_at, current_stage,
                    last_event_seq, report_available, error_json, seed_id, fixture_id,
                    target_url, mutation_version, fixture_digest, fingerprint_key_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.run_id,
                    request_id,
                    request_body,
                    run.agent_id,
                    self._json(run.test_case_ids),
                    run.status,
                    self._timestamp(run.created_at),
                    self._timestamp(run.started_at),
                    self._timestamp(run.finished_at),
                    run.current_stage,
                    run.last_event_seq,
                    int(run.report_available),
                    self._json(run.error.model_dump(mode="json")) if run.error else None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    fingerprint_key_id,
                ),
            )
        return CreateRunResult(run=run, created=True)

    def unfinished_key_ids(self) -> set[str]:
        rows = self._connection().execute(
            """
            SELECT DISTINCT fingerprint_key_id FROM runs
            WHERE status IN ('preflighting', 'ready', 'queued', 'running')
              AND fingerprint_key_id IS NOT NULL
            """
        ).fetchall()
        return {row["fingerprint_key_id"] for row in rows}

    def get_run(self, run_id: str) -> EvaluationRun | None:
        row = self._connection().execute(
            "SELECT * FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
        return self._run_from_row(row) if row is not None else None

    def get_run_by_request_id(self, request_id: str) -> EvaluationRun | None:
        row = self._connection().execute(
            "SELECT * FROM runs WHERE request_id = ?", (request_id,)
        ).fetchone()
        return self._run_from_row(row) if row is not None else None

    def create_comparison(
        self,
        comparison: EvaluationComparison,
        *,
        request_id: str,
    ) -> tuple[EvaluationComparison, bool]:
        request_body = self._json(
            {"mode": comparison.mode, "test_case_ids": comparison.test_case_ids}
        )
        with self._immediate() as connection:
            existing = connection.execute(
                "SELECT * FROM comparisons WHERE request_id = ?", (request_id,)
            ).fetchone()
            if existing is not None:
                if existing["request_body_json"] != request_body:
                    raise IdempotencyConflictError(
                        "comparison request_id was already used with different request data"
                    )
                return self._comparison_from_row(existing), False
            connection.execute(
                """
                INSERT INTO comparisons (
                    comparison_id, request_id, request_body_json, mode,
                    test_case_ids_json, bare_run_id, defended_run_id, status,
                    comparison_seed, created_at, bare_agent_id, defended_agent_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comparison.comparison_id,
                    request_id,
                    request_body,
                    comparison.mode,
                    self._json(comparison.test_case_ids),
                    comparison.bare_run_id,
                    comparison.defended_run_id,
                    comparison.status,
                    comparison.comparison_seed,
                    self._timestamp(comparison.created_at),
                    comparison.bare_agent_id,
                    comparison.defended_agent_id,
                ),
            )
        return comparison, True

    def get_comparison(self, comparison_id: str) -> EvaluationComparison | None:
        row = self._connection().execute(
            "SELECT * FROM comparisons WHERE comparison_id = ?", (comparison_id,)
        ).fetchone()
        return self._comparison_from_row(row) if row is not None else None

    def get_comparison_by_request_id(self, request_id: str) -> EvaluationComparison | None:
        row = self._connection().execute(
            "SELECT * FROM comparisons WHERE request_id = ?", (request_id,)
        ).fetchone()
        return self._comparison_from_row(row) if row is not None else None

    def list_active_comparisons(self) -> list[EvaluationComparison]:
        rows = self._connection().execute(
            """
            SELECT * FROM comparisons
            WHERE status IN ('creating', 'queued', 'running_bare', 'running_defended')
            ORDER BY created_at, comparison_id
            """
        ).fetchall()
        return [self._comparison_from_row(row) for row in rows]

    def update_comparison(
        self,
        comparison_id: str,
        *,
        status: str,
        bare_run_id: str | None = None,
        defended_run_id: str | None = None,
    ) -> EvaluationComparison:
        with self._immediate() as connection:
            connection.execute(
                """
                UPDATE comparisons
                SET status = ?, bare_run_id = COALESCE(?, bare_run_id),
                    defended_run_id = COALESCE(?, defended_run_id)
                WHERE comparison_id = ?
                """,
                (status, bare_run_id, defended_run_id, comparison_id),
            )
            row = connection.execute(
                "SELECT * FROM comparisons WHERE comparison_id = ?", (comparison_id,)
            ).fetchone()
        if row is None:
            raise KeyError(comparison_id)
        return self._comparison_from_row(row)

    def queue_run(self, run_id: str) -> bool:
        with self._immediate() as connection:
            cursor = connection.execute(
                "UPDATE runs SET status = 'queued' WHERE run_id = ? AND status = 'ready'",
                (run_id,),
            )
            return cursor.rowcount == 1

    def mark_preflight_ready(
        self,
        run_id: str,
        metadata: PreflightMetadata,
        event: ExecutionEvent,
    ) -> EvaluationRun:
        with self._immediate() as connection:
            cursor = connection.execute(
                """
                UPDATE runs
                SET status = 'ready', current_stage = 'web_content_injection',
                    seed_id = ?, fixture_id = ?, target_url = ?, mutation_version = ?,
                    fixture_digest = ?, error_json = NULL
                WHERE run_id = ? AND status = 'preflighting'
                """,
                (
                    metadata.seed_id,
                    metadata.fixture_id,
                    metadata.target_url,
                    metadata.mutation_version,
                    metadata.fixture_digest,
                    run_id,
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("run is not preflighting")
            self._append_event(connection, event)
            row = connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            return self._run_from_row(row)

    def mark_preflight_failed(
        self,
        run_id: str,
        *,
        code: str,
        message: str,
        event: ExecutionEvent,
    ) -> EvaluationRun:
        error = {"code": code, "message": message, "retryable": True}
        with self._immediate() as connection:
            connection.execute(
                """
                UPDATE runs SET status = 'preflight_failed', error_json = ?
                WHERE run_id = ? AND status = 'preflighting'
                """,
                (self._json(error), run_id),
            )
            self._append_event(connection, event)
            row = connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            return self._run_from_row(row)

    def get_run_context(self, run_id: str) -> RunContext | None:
        row = self._connection().execute(
            """
            SELECT seed_id, fixture_id, target_url, mutation_version, fixture_digest
            FROM runs WHERE run_id = ?
            """,
            (run_id,),
        ).fetchone()
        if row is None or row["seed_id"] is None:
            return None
        return RunContext(
            seed_id=row["seed_id"],
            fixture_id=row["fixture_id"],
            target_url=row["target_url"],
            mutation_version=row["mutation_version"],
            fixture_digest=row["fixture_digest"],
        )

    def mark_ready(self, run_id: str, event: ExecutionEvent) -> EvaluationRun:
        """D10: 非 R4 场景直接置 ready (无 seeded fixture, 无 canary preflight)."""
        with self._immediate() as connection:
            cursor = connection.execute(
                """
                UPDATE runs
                SET status = 'ready', current_stage = NULL,
                    seed_id = NULL, fixture_id = NULL, target_url = NULL,
                    mutation_version = NULL, fixture_digest = NULL,
                    error_json = NULL
                WHERE run_id = ? AND status = 'preflighting'
                """,
                (run_id,),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("run is not preflighting")
            self._append_event(connection, event)
            row = connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            return self._run_from_row(row)
    def set_current_stage(self, run_id: str, stage: str) -> None:
        with self._immediate() as connection:
            connection.execute(
                "UPDATE runs SET current_stage = ? WHERE run_id = ? AND status = 'running'",
                (stage, run_id),
            )

    def claim_next_queued(self) -> EvaluationRun | None:
        with self._immediate() as connection:
            row = connection.execute(
                """
                SELECT * FROM runs
                WHERE status = 'queued'
                ORDER BY created_at, run_id
                LIMIT 1
                """
            ).fetchone()
            if row is None:
                return None
            started_at = self._timestamp(self._now())
            cursor = connection.execute(
                """
                UPDATE runs SET status = 'running', started_at = ?
                WHERE run_id = ? AND status = 'queued'
                """,
                (started_at, row["run_id"]),
            )
            if cursor.rowcount != 1:
                return None
            self._append_event(
                connection,
                ExecutionEvent(
                    event_id=f"evt-{uuid4()}",
                    run_id=row["run_id"],
                    timestamp=self._now(),
                    type=EventType.RUN_STARTED,
                    payload={
                        "agent_id": row["agent_id"],
                        "test_case_ids": json.loads(row["test_case_ids_json"]),
                    },
                ),
            )
            claimed = connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (row["run_id"],)
            ).fetchone()
            return self._run_from_row(claimed)

    def append_event(self, event: ExecutionEvent) -> StoredExecutionEvent:
        with self._immediate() as connection:
            return self._append_event(connection, event)

    def _append_event(
        self, connection: sqlite3.Connection, event: ExecutionEvent
    ) -> StoredExecutionEvent:
        cursor = connection.execute(
            """
            UPDATE runs SET last_event_seq = last_event_seq + 1
            WHERE run_id = ?
            """,
            (event.run_id,),
        )
        if cursor.rowcount != 1:
            connection.execute(
                """
                INSERT INTO events (event_id, run_id, seq, timestamp, type, payload_json)
                VALUES (?, ?, 1, ?, ?, ?)
                """,
                (
                    event.event_id,
                    event.run_id,
                    self._timestamp(event.timestamp),
                    event.type.value,
                    self._json(event.payload),
                ),
            )
            raise sqlite3.IntegrityError(f"unknown run_id: {event.run_id}")

        seq = connection.execute(
            "SELECT last_event_seq FROM runs WHERE run_id = ?", (event.run_id,)
        ).fetchone()[0]
        connection.execute(
            """
            INSERT INTO events (event_id, run_id, seq, timestamp, type, payload_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                event.event_id,
                event.run_id,
                seq,
                self._timestamp(event.timestamp),
                event.type.value,
                self._json(event.payload),
            ),
        )
        return StoredExecutionEvent(
            **event.model_dump(),
            seq=seq,
        )

    def list_events(
        self, run_id: str, *, after_seq: int = 0, limit: int = 100
    ) -> list[StoredExecutionEvent]:
        if after_seq < 0:
            raise ValueError("after_seq must be non-negative")
        if limit < 1 or limit > 1000:
            raise ValueError("limit must be between 1 and 1000")
        rows = self._connection().execute(
            """
            SELECT * FROM events
            WHERE run_id = ? AND seq > ?
            ORDER BY seq
            LIMIT ?
            """,
            (run_id, after_seq, limit),
        ).fetchall()
        return [self._event_from_row(row) for row in rows]

    def interrupt_running_runs(self) -> list[str]:
        interrupted: list[str] = []
        with self._immediate() as connection:
            rows = connection.execute(
                "SELECT run_id FROM runs WHERE status = 'running' ORDER BY created_at, run_id"
            ).fetchall()
            for row in rows:
                run_id = row["run_id"]
                timestamp = self._now()
                error = {
                    "code": "PROCESS_RESTARTED",
                    "message": "Evaluation was interrupted by a process restart.",
                    "retryable": True,
                }
                connection.execute(
                    """
                    UPDATE runs
                    SET status = 'interrupted', finished_at = ?, error_json = ?
                    WHERE run_id = ? AND status = 'running'
                    """,
                    (self._timestamp(timestamp), self._json(error), run_id),
                )
                self._append_event(
                    connection,
                    ExecutionEvent(
                        event_id=f"evt-{uuid4()}",
                        run_id=run_id,
                        timestamp=timestamp,
                        type=EventType.RUN_FAILED,
                        payload={
                            "stage": "unconfirmed_email_send",
                            "error_code": "PROCESS_RESTARTED",
                            "retryable": True,
                        },
                    ),
                )
                self._append_event(
                    connection,
                    ExecutionEvent(
                        event_id=f"evt-{uuid4()}",
                        run_id=run_id,
                        timestamp=timestamp,
                        type=EventType.RUN_FINISHED,
                        payload={"status": "interrupted"},
                    ),
                )
                interrupted.append(run_id)
        return interrupted

    def interrupt_preflighting_runs(self) -> list[str]:
        interrupted: list[str] = []
        with self._immediate() as connection:
            rows = connection.execute(
                "SELECT run_id FROM runs WHERE status = 'preflighting' ORDER BY created_at, run_id"
            ).fetchall()
            for row in rows:
                run_id = row["run_id"]
                timestamp = self._now()
                error = {
                    "code": "PROCESS_RESTARTED",
                    "message": "Evaluation preflight was interrupted by a process restart.",
                    "retryable": True,
                }
                connection.execute(
                    """
                    UPDATE runs
                    SET status = 'interrupted', finished_at = ?, error_json = ?
                    WHERE run_id = ? AND status = 'preflighting'
                    """,
                    (self._timestamp(timestamp), self._json(error), run_id),
                )
                self._append_event(
                    connection,
                    ExecutionEvent(
                        event_id=f"evt-{uuid4()}",
                        run_id=run_id,
                        timestamp=timestamp,
                        type=EventType.RUN_FAILED,
                        payload={
                            "stage": "web_content_injection",
                            "error_code": "PROCESS_RESTARTED",
                            "retryable": True,
                        },
                    ),
                )
                self._append_event(
                    connection,
                    ExecutionEvent(
                        event_id=f"evt-{uuid4()}",
                        run_id=run_id,
                        timestamp=timestamp,
                        type=EventType.RUN_FINISHED,
                        payload={"status": "interrupted"},
                    ),
                )
                interrupted.append(run_id)
        return interrupted

    def save_judge_result(self, run_id: str, result: JudgeResult) -> None:
        payload = result.model_dump(mode="json")
        with self._immediate() as connection:
            connection.execute(
                """
                INSERT INTO judge_results (run_id, judge_id, result_json, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    judge_id = excluded.judge_id,
                    result_json = excluded.result_json,
                    created_at = excluded.created_at
                """,
                (run_id, result.judge_id, self._json(payload), self._timestamp(result.judged_at)),
            )

    def get_judge_result(self, run_id: str) -> JudgeResult | None:
        row = self._connection().execute(
            "SELECT result_json FROM judge_results WHERE run_id = ?", (run_id,)
        ).fetchone()
        return JudgeResult.model_validate_json(row["result_json"]) if row else None

    def save_report(self, run_id: str, report: EvaluationReport) -> None:
        payload = report.model_dump(mode="json")
        with self._immediate() as connection:
            connection.execute(
                """
                INSERT INTO reports (run_id, report_id, report_json, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    report_id = excluded.report_id,
                    report_json = excluded.report_json,
                    created_at = excluded.created_at
                """,
                (run_id, report.report_id, self._json(payload), self._timestamp(report.created_at)),
            )
            connection.execute(
                "UPDATE runs SET report_available = 1 WHERE run_id = ?", (run_id,)
            )

    def complete_run(
        self,
        run_id: str,
        *,
        judge_result: JudgeResult,
        report: EvaluationReport,
        events: list[ExecutionEvent],
    ) -> EvaluationRun:
        """Atomically publish Judge, report, terminal events, and completed state."""
        with self._immediate() as connection:
            current = connection.execute(
                "SELECT status FROM runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if current is None:
                raise KeyError(run_id)
            if current["status"] != "running":
                raise RuntimeError("run is not running")
            judge_payload = judge_result.model_dump(mode="json")
            report_payload = report.model_dump(mode="json")
            connection.execute(
                """
                INSERT INTO judge_results (run_id, judge_id, result_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    run_id,
                    judge_result.judge_id,
                    self._json(judge_payload),
                    self._timestamp(judge_result.judged_at),
                ),
            )
            connection.execute(
                """
                INSERT INTO reports (run_id, report_id, report_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    run_id,
                    report.report_id,
                    self._json(report_payload),
                    self._timestamp(report.created_at),
                ),
            )
            for event in events:
                self._append_event(connection, event)
            finished_at = self._timestamp(self._now())
            connection.execute(
                """
                UPDATE runs
                SET status = 'completed', finished_at = ?, report_available = 1,
                    current_stage = 'unconfirmed_email_send', error_json = NULL
                WHERE run_id = ? AND status = 'running'
                """,
                (finished_at, run_id),
            )
            row = connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            return self._run_from_row(row)

    def fail_running_run(
        self,
        run_id: str,
        *,
        code: str,
        message: str,
        retryable: bool,
        stage: str,
    ) -> EvaluationRun:
        timestamp = self._now()
        error = {"code": code, "message": message, "retryable": retryable}
        with self._immediate() as connection:
            self._append_event(
                connection,
                ExecutionEvent(
                    event_id=f"evt-{uuid4()}",
                    run_id=run_id,
                    timestamp=timestamp,
                    type=EventType.RUN_FAILED,
                    payload={"stage": stage, "error_code": code, "retryable": retryable},
                ),
            )
            self._append_event(
                connection,
                ExecutionEvent(
                    event_id=f"evt-{uuid4()}",
                    run_id=run_id,
                    timestamp=timestamp,
                    type=EventType.RUN_FINISHED,
                    payload={"status": "failed"},
                ),
            )
            connection.execute(
                """
                UPDATE runs SET status = 'failed', finished_at = ?, error_json = ?
                WHERE run_id = ? AND status = 'running'
                """,
                (self._timestamp(timestamp), self._json(error), run_id),
            )
            row = connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            return self._run_from_row(row)

    def get_report(self, run_id: str) -> EvaluationReport | None:
        row = self._connection().execute(
            "SELECT report_json FROM reports WHERE run_id = ?", (run_id,)
        ).fetchone()
        return EvaluationReport.model_validate_json(row["report_json"]) if row else None

    @staticmethod
    def _comparison_from_row(row: sqlite3.Row) -> EvaluationComparison:
        return EvaluationComparison.model_validate(
            {
                "comparison_id": row["comparison_id"],
                "mode": row["mode"],
                "test_case_ids": json.loads(row["test_case_ids_json"]),
                "bare_run_id": row["bare_run_id"],
                "defended_run_id": row["defended_run_id"],
                "status": row["status"],
                "comparison_seed": row["comparison_seed"],
                "created_at": row["created_at"],
                "bare_agent_id": row["bare_agent_id"],
                "defended_agent_id": row["defended_agent_id"],
            }
        )

    @staticmethod
    def _run_from_row(row: sqlite3.Row) -> EvaluationRun:
        return EvaluationRun.model_validate(
            {
                "run_id": row["run_id"],
                "agent_id": row["agent_id"],
                "test_case_ids": json.loads(row["test_case_ids_json"]),
                "status": row["status"],
                "created_at": row["created_at"],
                "started_at": row["started_at"],
                "finished_at": row["finished_at"],
                "current_stage": row["current_stage"],
                "last_event_seq": row["last_event_seq"],
                "report_available": bool(row["report_available"]),
                "error": json.loads(row["error_json"]) if row["error_json"] else None,
            }
        )

    @staticmethod
    def _event_from_row(row: sqlite3.Row) -> StoredExecutionEvent:
        return StoredExecutionEvent.model_validate(
            {
                "event_id": row["event_id"],
                "run_id": row["run_id"],
                "seq": row["seq"],
                "timestamp": row["timestamp"],
                "type": row["type"],
                "payload": json.loads(row["payload_json"]),
            }
        )

    def close(self) -> None:
        with self._connections_lock:
            connections = tuple(self._connections)
            self._connections.clear()
        for connection in connections:
            connection.close()
        self._closed = True
        self._local = threading.local()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
