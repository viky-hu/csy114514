"""Evaluation API contract and lifecycle tests."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from backend.app.main import app
from backend.app.services import evaluation_service

CREATE_BODY = {
    "request_id": "request-001",
    "agent_id": "corpmate-v0",
    "test_case_ids": ["tc_pipi_001"],
}


@pytest_asyncio.fixture
async def client(tmp_path):
    evaluation_service.configure(
        database_path=tmp_path / "evaluations.sqlite3",
        fingerprint_key="test-fingerprint-key-with-sufficient-entropy",
        start_worker=False,
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as value:
        yield value
    evaluation_service.shutdown()


@pytest.mark.asyncio
async def test_create_preflights_and_is_idempotent(client):
    first = await client.post("/evaluations", json=CREATE_BODY)
    assert first.status_code == 201
    assert first.json()["status"] == "ready"
    assert first.json()["current_stage"] == "web_content_injection"
    assert first.json()["last_event_seq"] == 1

    repeated = await client.post("/evaluations", json=CREATE_BODY)
    assert repeated.status_code == 200
    assert repeated.json()["run_id"] == first.json()["run_id"]


@pytest.mark.asyncio
async def test_idempotency_conflict_uses_unified_error(client):
    await client.post("/evaluations", json=CREATE_BODY)
    response = await client.post(
        "/evaluations",
        json={**CREATE_BODY, "agent_id": "other-agent"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


@pytest.mark.asyncio
async def test_rejects_invalid_test_case_selection(client):
    response = await client.post(
        "/evaluations",
        json={**CREATE_BODY, "test_case_ids": ["tc_ipi_001", "tc_pipi_001"]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TEST_CASE_SELECTION"


@pytest.mark.asyncio
async def test_start_is_atomic_and_repeatable(client):
    created = await client.post("/evaluations", json=CREATE_BODY)
    run_id = created.json()["run_id"]

    first = await client.post(f"/evaluations/{run_id}/start")
    repeated = await client.post(f"/evaluations/{run_id}/start")
    assert first.status_code == 202
    assert repeated.status_code == 202
    assert first.json()["run_id"] == run_id
    assert repeated.json()["status"] in {"queued", "running"}


@pytest.mark.asyncio
async def test_report_not_ready_then_available_after_real_worker_run(client):
    created = await client.post("/evaluations", json=CREATE_BODY)
    run_id = created.json()["run_id"]

    pending = await client.get(f"/evaluations/{run_id}/report")
    assert pending.status_code == 409
    assert pending.json()["error"]["code"] == "REPORT_NOT_READY"

    await client.post(f"/evaluations/{run_id}/start")
    evaluation_service.process_queued_once()

    snapshot = await client.get(f"/evaluations/{run_id}")
    assert snapshot.json()["status"] == "completed"
    assert snapshot.json()["report_available"] is True

    report = await client.get(f"/evaluations/{run_id}/report")
    assert report.status_code == 200
    assert report.json()["score_breakdown"]["algorithm_version"] == "r4-mvp-v1"
    assert report.json()["findings"][0]["rule_types"] == ["full_chain_persistent_ipi"]

    trace = await client.get(f"/evaluations/{run_id}/trace")
    assert trace.status_code == 200
    assert trace.json()["run_id"] == run_id
    assert trace.json()["events"][-1]["type"] == "RUN_FINISHED"


@pytest.mark.asyncio
async def test_unknown_evaluation_uses_unified_error(client):
    response = await client.get("/evaluations/missing")
    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "EVALUATION_NOT_FOUND",
            "message": "Evaluation was not found.",
            "details": {"evaluation_id": "missing"},
        }
    }
