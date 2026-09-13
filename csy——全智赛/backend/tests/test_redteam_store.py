"""Persistence tests for owner-scoped red-team connections and runs."""
from __future__ import annotations

from backend.app.domain.redteam_run import RedTeamRunConfig
from backend.app.persistence.redteam_store import SQLiteRedTeamStore


def test_store_scopes_connections_runs_and_events_to_the_owner(tmp_path):
    """Removing an owner filter would expose another user's target and report."""
    store = SQLiteRedTeamStore(tmp_path / "redteam.sqlite3")
    connection = store.create_connection(
        owner_id="alice",
        agent_id="alice-agent",
        endpoint="https://adapter.example.com",
        auth_reference="vault://alice/redteam",
        adapter_metadata={"protocol_version": "v1", "environment": "test", "supports_reset": True},
    )
    run = store.create_run(
        owner_id="alice",
        agent_id="alice-agent",
        connection_id=connection.connection_id,
        random_seed=8675309,
        adapter_metadata_snapshot=connection.adapter_metadata,
        config=RedTeamRunConfig(rounds=2, seed_count=3, variants_per_seed=1),
    )
    event = store.append_event(run.run_id, "RUN_CREATED", {"agent_id": "alice-agent"})

    assert connection.auth_reference == "vault://alice/redteam"
    assert run.random_seed == 8675309
    assert run.adapter_metadata_snapshot == connection.adapter_metadata
    assert store.get_connection(connection.connection_id, owner_id="bob") is None
    assert store.get_run(run.run_id, owner_id="bob") is None
    assert [item.run_id for item in store.list_runs(owner_id="alice")] == [run.run_id]
    assert store.list_events(run.run_id, after_seq=0, owner_id="alice") == [event]
