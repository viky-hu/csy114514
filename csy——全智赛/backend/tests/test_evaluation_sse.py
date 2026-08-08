"""SQLite SSE replay, cursor, multi-subscriber, and redaction tests."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from backend.app.main import app
from backend.app.security.fingerprints import derive_canary
from backend.app.services import evaluation_service

KEY = "sse-test-fingerprint-key"


@pytest_asyncio.fixture
async def client(tmp_path):
    evaluation_service.configure(
        database_path=tmp_path / "events.sqlite3",
        fingerprint_key=KEY,
        start_worker=False,
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as value:
        yield value
    evaluation_service.shutdown()


async def completed_run(client: AsyncClient) -> str:
    created = await client.post(
        "/evaluations",
        json={
            "request_id": "sse-request",
            "agent_id": "corpmate-v0",
            "test_case_ids": ["tc_pipi_001"],
        },
    )
    run_id = created.json()["run_id"]
    await client.post(f"/evaluations/{run_id}/start")
    evaluation_service.process_queued_once()
    return run_id


@pytest.mark.asyncio
async def test_terminal_stream_replays_and_closes(client) -> None:
    run_id = await completed_run(client)
    response = await client.get(f"/evaluations/{run_id}/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert f"id: {run_id}:1" in response.text
    assert "PREFLIGHT_COMPLETED" in response.text
    assert "RUN_FINISHED" in response.text
    assert "retry: 3000" in response.text


@pytest.mark.asyncio
async def test_two_subscribers_receive_the_same_replay(client) -> None:
    run_id = await completed_run(client)
    first = await client.get(f"/evaluations/{run_id}/events")
    second = await client.get(f"/evaluations/{run_id}/events")
    assert first.text == second.text


@pytest.mark.asyncio
async def test_after_and_last_event_id_resume_after_cursor(client) -> None:
    run_id = await completed_run(client)
    after = await client.get(f"/evaluations/{run_id}/events?after=1")
    header = await client.get(
        f"/evaluations/{run_id}/events",
        headers={"Last-Event-ID": f"{run_id}:1"},
    )
    assert "PREFLIGHT_COMPLETED" not in after.text
    assert after.text == header.text


@pytest.mark.asyncio
async def test_rejects_cursor_from_another_run(client) -> None:
    run_id = await completed_run(client)
    response = await client.get(
        f"/evaluations/{run_id}/events",
        headers={"Last-Event-ID": "other-run:1"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_EVENT_CURSOR"


@pytest.mark.asyncio
async def test_stream_never_contains_raw_canary_or_secret(client) -> None:
    run_id = await completed_run(client)
    response = await client.get(f"/evaluations/{run_id}/events")
    assert derive_canary(KEY, run_id) not in response.text
    assert KEY not in response.text
    assert "external-archive@example.net" not in response.text
