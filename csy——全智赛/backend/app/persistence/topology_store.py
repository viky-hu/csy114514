"""SQLite persistence for per-agent topology selections."""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from backend.app.domain.agent_topology import AgentTopology


class SQLiteTopologyStore:
    """Persist the latest complete topology document for each Agent."""

    def __init__(self, database_path: str | Path) -> None:
        path = Path(database_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self._path = str(path)
        self._local = threading.local()
        self._connection().execute(
            """
            CREATE TABLE IF NOT EXISTS agent_topologies (
                agent_id TEXT PRIMARY KEY,
                topology_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    def _connection(self) -> sqlite3.Connection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = sqlite3.connect(
                self._path,
                isolation_level=None,
                check_same_thread=False,
            )
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA journal_mode = WAL")
            self._local.connection = connection
        return connection

    def set(self, topology: AgentTopology) -> AgentTopology:
        if not topology.agent_id:
            raise ValueError("persisted topology requires agent_id")
        self._connection().execute(
            """
            INSERT INTO agent_topologies(agent_id, topology_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(agent_id) DO UPDATE SET
                topology_json = excluded.topology_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (topology.agent_id, topology.model_dump_json()),
        )
        return topology

    def get(self, agent_id: str) -> AgentTopology | None:
        row = self._connection().execute(
            "SELECT topology_json FROM agent_topologies WHERE agent_id = ?",
            (agent_id,),
        ).fetchone()
        if row is None:
            return None
        return AgentTopology.model_validate_json(row["topology_json"])

    def close(self) -> None:
        connection = getattr(self._local, "connection", None)
        if connection is not None:
            connection.close()
            del self._local.connection
