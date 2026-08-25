"""Topology API — register and query agent topology configurations.

Endpoints:
  GET  /topology/presets          — list available topology presets
  GET  /topology/{agent_id}       — get topology for an agent (default: single)
  POST /topology/{agent_id}       — set topology for an agent
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.app.domain.agent_topology import AgentTopology
from backend.app.domain.topology_presets import (
    TOPOLOGY_PRESETS,
    get_topology_preset,
    list_presets,
)
from backend.app.services import agent_service

router = APIRouter(prefix="/topology", tags=["topology"])

# In-memory store: agent_id → AgentTopology
# Sufficient for competition demo. No persistence needed.
_TOPOLOGY_STORE: dict[str, AgentTopology] = {}


class SetTopologyRequest(BaseModel):
    """Request body for setting agent topology."""

    preset_name: str = Field(
        ...,
        description="Preset name: single|planner_executor|rag_agent",
    )


class PresetSummary(BaseModel):
    """Summary info for a topology preset."""

    topology_type: str
    description: str
    node_count: int
    edge_count: int


@router.get("/presets", response_model=list[PresetSummary])
async def list_topology_presets():
    """List available topology presets."""
    return list_presets()


@router.get("/{agent_id}", response_model=AgentTopology)
async def get_topology(agent_id: str):
    """Get topology configuration for an agent.

    Returns the 'single' default topology if none has been set.
    """
    if agent_id in _TOPOLOGY_STORE:
        return _TOPOLOGY_STORE[agent_id]
    return get_topology_preset("single", agent_id)


@router.post("/{agent_id}", response_model=AgentTopology)
async def set_topology(agent_id: str, req: SetTopologyRequest):
    """Set topology configuration for an agent.

    Accepts a preset_name and expands it to a full AgentTopology.
    Returns 422 if preset_name is unknown.
    """
    try:
        topology = get_topology_preset(req.preset_name, agent_id)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown topology preset: {req.preset_name!r}. "
                f"Available: {', '.join(sorted(TOPOLOGY_PRESETS))}"
            ),
        )
    _TOPOLOGY_STORE[agent_id] = topology
    # Rebuild the attack graph with the new topology
    agent_service.rebuild_graph(agent_id, topology)
    return topology


def get_topology_for_agent(agent_id: str) -> AgentTopology | None:
    """Programmatic access for internal modules (e.g. graph_builder callers).

    Returns None if no topology has been explicitly set (caller should treat
    as 'single' default).
    """
    return _TOPOLOGY_STORE.get(agent_id)


def clear_topology_store() -> None:
    """Clear all stored topologies. For testing only."""
    _TOPOLOGY_STORE.clear()
