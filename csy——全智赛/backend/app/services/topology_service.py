"""Configured lifecycle for persistent Agent topology selections."""
from __future__ import annotations

from pathlib import Path

from backend.app.config import settings
from backend.app.domain.agent_topology import AgentTopology
from backend.app.persistence.topology_store import SQLiteTopologyStore

_store: SQLiteTopologyStore | None = None


def configure(*, database_path: str | Path) -> SQLiteTopologyStore:
    global _store
    shutdown()
    _store = SQLiteTopologyStore(database_path)
    return _store


def _configured_store() -> SQLiteTopologyStore:
    if _store is None:
        # Direct API tests and one-off CLI calls do not enter FastAPI's lifespan.
        # They still need the same SQLite-backed behaviour rather than an in-memory
        # substitute, while normal startup configures this store explicitly.
        return configure(database_path=settings.topology_database_path)
    return _store


def set_topology(topology: AgentTopology) -> AgentTopology:
    return _configured_store().set(topology)


def get_topology(agent_id: str) -> AgentTopology | None:
    return _configured_store().get(agent_id)


def shutdown() -> None:
    global _store
    if _store is not None:
        _store.close()
        _store = None
