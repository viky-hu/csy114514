"""Test /evaluations endpoints."""
import pytest
import pytest_asyncio
from backend.app.main import app
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_post_evaluations_returns_report(client):
    response = await client.post("/evaluations", json={"agent_id": "corpmate-v0"})
    assert response.status_code == 201
    data = response.json()
    assert data["agent_id"] == "corpmate-v0"
    assert "report_id" in data
    assert "findings" in data


@pytest.mark.asyncio
async def test_get_evaluation_returns_report(client):
    create_resp = await client.post("/evaluations", json={"agent_id": "corpmate-v0"})
    eval_id = create_resp.json()["evaluation_id"]

    response = await client.get(f"/evaluations/{eval_id}")
    assert response.status_code == 200
    assert response.json()["evaluation_id"] == eval_id


@pytest.mark.asyncio
async def test_get_evaluation_unknown_returns_404(client):
    response = await client.get("/evaluations/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_evaluation_report_returns_report(client):
    create_resp = await client.post("/evaluations", json={"agent_id": "corpmate-v0"})
    eval_id = create_resp.json()["evaluation_id"]

    response = await client.get(f"/evaluations/{eval_id}/report")
    assert response.status_code == 200
    data = response.json()
    assert data["agent_id"] == "corpmate-v0"
    assert "conclusion" in data


@pytest.mark.asyncio
async def test_get_report_unknown_returns_404(client):
    response = await client.get("/evaluations/nonexistent/report")
    assert response.status_code == 404
