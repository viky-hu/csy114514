"""Test /agents endpoints."""
import pytest
import pytest_asyncio
from backend.app.main import app
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


VALID_MANIFEST = {
    "agent_id": "corpmate-v0",
    "name": "CorpMate v0",
    "version": "0.1.0",
    "capabilities": ["chat", "browser.open_page", "email.send"],
    "data_sources": ["browser", "email"],
    "memory": {"type": "persistent"},
    "tool_permissions": {
        "browser.open_page": "ALLOW",
        "email.send": "CONFIRM",
    },
}


@pytest.mark.asyncio
async def test_post_agents_returns_201_with_profile(client):
    response = await client.post("/agents", json=VALID_MANIFEST)
    assert response.status_code == 201
    data = response.json()
    assert data["agent_id"] == "corpmate-v0"
    assert "profile_id" in data
    assert "manifest" in data
    assert data["manifest"]["agent_id"] == "corpmate-v0"


@pytest.mark.asyncio
async def test_post_agents_rejects_invalid_manifest(client):
    response = await client.post("/agents", json={"name": "no agent_id"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_get_agent_returns_profile(client):
    await client.post("/agents", json=VALID_MANIFEST)
    response = await client.get("/agents/corpmate-v0")
    assert response.status_code == 200
    data = response.json()
    assert data["agent_id"] == "corpmate-v0"


@pytest.mark.asyncio
async def test_get_agent_unknown_id_returns_404(client):
    response = await client.get("/agents/nonexistent-agent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_agent_graph_returns_attack_graph(client):
    await client.post("/agents", json=VALID_MANIFEST)
    response = await client.get("/agents/corpmate-v0/graph")
    assert response.status_code == 200
    data = response.json()
    assert data["agent_id"] == "corpmate-v0"
    assert len(data["nodes"]) >= 1
    assert len(data["edges"]) >= 1
    assert "risk_path_ids" in data


@pytest.mark.asyncio
async def test_get_agent_graph_unknown_id_returns_404(client):
    response = await client.get("/agents/nonexistent/graph")
    assert response.status_code == 404
