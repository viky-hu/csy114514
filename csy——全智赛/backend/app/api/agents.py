"""Agent API endpoints — POST /agents, GET /agents/{id}, GET /agents/{id}/graph."""
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.services import agent_service
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", status_code=201)
async def create_agent(manifest: AgentManifest):
    """Register a new Agent from its manifest. Returns AgentProfile."""
    profile = agent_service.register_agent(manifest)
    return profile.model_dump(mode="json")


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get AgentProfile by ID."""
    profile = agent_service.get_agent(agent_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return profile.model_dump(mode="json")


@router.get("/{agent_id}/graph")
async def get_agent_graph(agent_id: str):
    """Get AttackGraph for an agent."""
    graph = agent_service.get_attack_graph(agent_id)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return graph.model_dump(mode="json")
