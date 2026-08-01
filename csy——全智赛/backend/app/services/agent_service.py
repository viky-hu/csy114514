"""Agent service — currently mock: reads from shared/fixtures/."""
import json
from pathlib import Path

from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.agent_profile import AgentProfile
from backend.app.domain.attack_graph import AttackGraph

FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / "shared" / "fixtures"

# In-memory store (mock, no database in Stage 1)
_profiles: dict[str, AgentProfile] = {}
_graphs: dict[str, AttackGraph] = {}


def _load_fixture(filename: str) -> dict:
    path = FIXTURES_DIR / filename
    return json.loads(path.read_text(encoding="utf-8"))


def register_agent(manifest: AgentManifest) -> AgentProfile:
    """Register a new agent from its manifest. Returns populated profile."""
    fixture_data = _load_fixture("agent_profile.json")
    profile = AgentProfile.model_validate({
        **fixture_data,
        "agent_id": manifest.agent_id,
        "manifest": manifest.model_dump(mode="json"),
    })
    _profiles[manifest.agent_id] = profile
    return profile


def get_agent(agent_id: str) -> AgentProfile | None:
    """Get agent profile by ID."""
    return _profiles.get(agent_id)


def get_attack_graph(agent_id: str) -> AttackGraph | None:
    """Get attack graph for an agent."""
    if agent_id not in _profiles:
        return None
    fixture_data = _load_fixture("attack_graph.json")
    graph = AttackGraph.model_validate({
        **fixture_data,
        "agent_id": agent_id,
    })
    return graph
