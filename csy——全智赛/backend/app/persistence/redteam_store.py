"""SQLite persistence for owner-scoped red-team connections, runs and SSE events."""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.app.domain.redteam_run import (
    RedTeamConnection,
    RedTeamRun,
    RedTeamRunConfig,
    RedTeamRunEvent,
)


class SQLiteRedTeamStore:
    def __init__(self, database_path: str | Path) -> None:
        path = Path(database_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self._path = str(path)
        self._local = threading.local()
        self._initialize_schema()

    def _connection(self) -> sqlite3.Connection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = sqlite3.connect(self._path, isolation_level=None, check_same_thread=False)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA journal_mode = WAL")
            self._local.connection = connection
        return connection

    def _initialize_schema(self) -> None:
        self._connection().executescript(
            """
            CREATE TABLE IF NOT EXISTS redteam_connections (
                connection_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                auth_reference TEXT,
                adapter_metadata_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_redteam_connections_owner
                ON redteam_connections(owner_id, agent_id);
            CREATE TABLE IF NOT EXISTS redteam_runs (
                run_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                connection_id TEXT NOT NULL REFERENCES redteam_connections(connection_id),
                random_seed INTEGER NOT NULL,
                adapter_metadata_snapshot_json TEXT NOT NULL DEFAULT '{}',
                config_json TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                current_round INTEGER NOT NULL DEFAULT 0,
                last_event_seq INTEGER NOT NULL DEFAULT 0,
                report_available INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                selected_seed_ids_json TEXT NOT NULL DEFAULT '[]',
                selected_seed_snapshot_json TEXT NOT NULL DEFAULT '[]'
            );
            CREATE INDEX IF NOT EXISTS idx_redteam_runs_owner
                ON redteam_runs(owner_id, created_at DESC);
            CREATE TABLE IF NOT EXISTS redteam_events (
                event_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL REFERENCES redteam_runs(run_id) ON DELETE CASCADE,
                seq INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                UNIQUE(run_id, seq)
            );
            CREATE TABLE IF NOT EXISTS redteam_reports (
                run_id TEXT PRIMARY KEY REFERENCES redteam_runs(run_id) ON DELETE CASCADE,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        self._add_column_if_missing("redteam_runs", "random_seed", "INTEGER NOT NULL DEFAULT 0")
        self._add_column_if_missing("redteam_runs", "adapter_metadata_snapshot_json", "TEXT NOT NULL DEFAULT '{}'")
        self._add_column_if_missing("redteam_runs", "selected_seed_snapshot_json", "TEXT NOT NULL DEFAULT '[]'")

    def _add_column_if_missing(self, table: str, column: str, definition: str) -> None:
        columns = {row["name"] for row in self._connection().execute(f"PRAGMA table_info({table})")}
        if column not in columns:
            self._connection().execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _timestamp(value: datetime | None) -> str | None:
        return value.astimezone(timezone.utc).isoformat() if value else None

    @staticmethod
    def _parse_timestamp(value: str | None) -> datetime | None:
        return datetime.fromisoformat(value) if value else None

    @staticmethod
    def _json(value: object) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    def create_connection(
        self,
        *,
        owner_id: str,
        agent_id: str,
        endpoint: str,
        auth_reference: str | None,
        adapter_metadata: dict,
    ) -> RedTeamConnection:
        connection = RedTeamConnection(
            connection_id=f"rtc-{uuid4().hex}",
            owner_id=owner_id,
            agent_id=agent_id,
            endpoint=endpoint,
            auth_reference=auth_reference,
            adapter_metadata=adapter_metadata,
            created_at=self._now(),
        )
        self._connection().execute(
            """INSERT INTO redteam_connections VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                connection.connection_id, owner_id, agent_id, endpoint, auth_reference,
                self._json(adapter_metadata), self._timestamp(connection.created_at),
            ),
        )
        return connection

    def _connection_from_row(self, row: sqlite3.Row) -> RedTeamConnection:
        return RedTeamConnection(
            connection_id=row["connection_id"], owner_id=row["owner_id"], agent_id=row["agent_id"],
            endpoint=row["endpoint"], auth_reference=row["auth_reference"],
            adapter_metadata=json.loads(row["adapter_metadata_json"]),
            created_at=self._parse_timestamp(row["created_at"]),
        )

    def get_connection(self, connection_id: str, *, owner_id: str) -> RedTeamConnection | None:
        row = self._connection().execute(
            "SELECT * FROM redteam_connections WHERE connection_id = ? AND owner_id = ?",
            (connection_id, owner_id),
        ).fetchone()
        return self._connection_from_row(row) if row else None

    def list_connections(self, *, owner_id: str, agent_id: str | None = None) -> list[RedTeamConnection]:
        sql = "SELECT * FROM redteam_connections WHERE owner_id = ?"
        params: list[str] = [owner_id]
        if agent_id:
            sql += " AND agent_id = ?"
            params.append(agent_id)
        sql += " ORDER BY created_at DESC"
        return [self._connection_from_row(row) for row in self._connection().execute(sql, params).fetchall()]

    def create_run(
        self,
        *,
        owner_id: str,
        agent_id: str,
        connection_id: str,
        random_seed: int,
        adapter_metadata_snapshot: dict,
        config: RedTeamRunConfig,
    ) -> RedTeamRun:
        run = RedTeamRun(
            run_id=f"rtr-{uuid4().hex}", owner_id=owner_id, agent_id=agent_id,
            connection_id=connection_id, random_seed=random_seed,
            adapter_metadata_snapshot=adapter_metadata_snapshot, config=config, status="queued", created_at=self._now(),
        )
        self._connection().execute(
            """INSERT INTO redteam_runs (
                run_id, owner_id, agent_id, connection_id, random_seed, adapter_metadata_snapshot_json,
                config_json, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run.run_id, owner_id, agent_id, connection_id, random_seed, self._json(adapter_metadata_snapshot),
             self._json(config.model_dump()), run.status, self._timestamp(run.created_at)),
        )
        return run

    def _run_from_row(self, row: sqlite3.Row) -> RedTeamRun:
        return RedTeamRun(
            run_id=row["run_id"], owner_id=row["owner_id"], agent_id=row["agent_id"],
            connection_id=row["connection_id"], random_seed=row["random_seed"],
            adapter_metadata_snapshot=json.loads(row["adapter_metadata_snapshot_json"]),
            config=RedTeamRunConfig.model_validate(json.loads(row["config_json"])),
            status=row["status"], created_at=self._parse_timestamp(row["created_at"]),
            started_at=self._parse_timestamp(row["started_at"]), finished_at=self._parse_timestamp(row["finished_at"]),
            current_round=row["current_round"], last_event_seq=row["last_event_seq"],
            report_available=bool(row["report_available"]), error_message=row["error_message"],
            selected_seed_ids=json.loads(row["selected_seed_ids_json"]),
            selected_seed_snapshot=json.loads(row["selected_seed_snapshot_json"]),
        )

    def get_run(self, run_id: str, *, owner_id: str) -> RedTeamRun | None:
        row = self._connection().execute(
            "SELECT * FROM redteam_runs WHERE run_id = ? AND owner_id = ?", (run_id, owner_id)
        ).fetchone()
        return self._run_from_row(row) if row else None

    def list_runs(self, *, owner_id: str, limit: int = 50) -> list[RedTeamRun]:
        rows = self._connection().execute(
            "SELECT * FROM redteam_runs WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?", (owner_id, limit)
        ).fetchall()
        return [self._run_from_row(row) for row in rows]

    def append_event(self, run_id: str, event_type: str, payload: dict) -> RedTeamRunEvent:
        connection = self._connection()
        connection.execute("BEGIN IMMEDIATE")
        try:
            row = connection.execute("SELECT last_event_seq FROM redteam_runs WHERE run_id = ?", (run_id,)).fetchone()
            if row is None:
                raise LookupError("Red-team run not found.")
            event = RedTeamRunEvent(
                event_id=f"rte-{uuid4().hex}", run_id=run_id, seq=row["last_event_seq"] + 1,
                timestamp=self._now(), type=event_type, payload=payload,
            )
            connection.execute(
                "INSERT INTO redteam_events VALUES (?, ?, ?, ?, ?, ?)",
                (event.event_id, run_id, event.seq, self._timestamp(event.timestamp), event.type, self._json(payload)),
            )
            connection.execute("UPDATE redteam_runs SET last_event_seq = ? WHERE run_id = ?", (event.seq, run_id))
            connection.commit()
            return event
        except BaseException:
            connection.rollback()
            raise

    def list_events(self, run_id: str, *, after_seq: int, owner_id: str) -> list[RedTeamRunEvent]:
        if self.get_run(run_id, owner_id=owner_id) is None:
            return []
        rows = self._connection().execute(
            "SELECT * FROM redteam_events WHERE run_id = ? AND seq > ? ORDER BY seq", (run_id, after_seq)
        ).fetchall()
        return [RedTeamRunEvent(
            event_id=row["event_id"], run_id=row["run_id"], seq=row["seq"],
            timestamp=self._parse_timestamp(row["timestamp"]), type=row["type"],
            payload=json.loads(row["payload_json"]),
        ) for row in rows]

    def update_run(
        self, run_id: str, *, status: str, current_round: int | None = None,
        selected_seed_ids: list[str] | None = None, selected_seed_snapshot: list[dict] | None = None,
        error_message: str | None = None,
    ) -> None:
        now = self._timestamp(self._now())
        sets = ["status = ?"]
        values: list[object] = [status]
        if status == "running":
            sets.append("started_at = COALESCE(started_at, ?)")
            values.append(now)
        if status in {"completed", "failed"}:
            sets.append("finished_at = ?")
            values.append(now)
        if current_round is not None:
            sets.append("current_round = ?")
            values.append(current_round)
        if selected_seed_ids is not None:
            sets.append("selected_seed_ids_json = ?")
            values.append(self._json(selected_seed_ids))
        if selected_seed_snapshot is not None:
            sets.append("selected_seed_snapshot_json = ?")
            values.append(self._json(selected_seed_snapshot))
        if error_message is not None:
            sets.append("error_message = ?")
            values.append(error_message[:500])
        values.append(run_id)
        self._connection().execute(f"UPDATE redteam_runs SET {', '.join(sets)} WHERE run_id = ?", values)

    def save_report(self, run_id: str, report: dict) -> None:
        now = self._timestamp(self._now())
        self._connection().execute(
            "INSERT OR REPLACE INTO redteam_reports(run_id, report_json, created_at) VALUES (?, ?, ?)",
            (run_id, self._json(report), now),
        )
        self._connection().execute("UPDATE redteam_runs SET report_available = 1 WHERE run_id = ?", (run_id,))

    def get_report(self, run_id: str, *, owner_id: str) -> dict | None:
        if self.get_run(run_id, owner_id=owner_id) is None:
            return None
        row = self._connection().execute("SELECT report_json FROM redteam_reports WHERE run_id = ?", (run_id,)).fetchone()
        return json.loads(row["report_json"]) if row else None
