"""Agent service — registers agents and builds their AttackGraph (P2-0a).

Profiles are stored in memory (mock, no database in Stage 1). The attack graph
is now generated from the manifest instead of read from fixture.
"""
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.agent_profile import AgentProfile
from backend.app.domain.attack_graph import AttackGraph
from backend.app.services.graph_builder import build_attack_graph

# In-memory store (mock, no database in Stage 1)
_profiles: dict[str, AgentProfile] = {}
_graphs: dict[str, AttackGraph] = {}


def register_agent(manifest: AgentManifest) -> AgentProfile:
    """Register a new agent from its manifest. Returns populated profile."""
    profile = AgentProfile(
        profile_id=f"profile-{manifest.agent_id}",
        agent_id=manifest.agent_id,
        manifest=manifest,
        capability_profile={
            "tool_count": len(manifest.capabilities),
            "data_sources": manifest.data_sources,
            "memory_type": manifest.memory.get("type"),
            "memory": manifest.memory,
        },
        security_assets={
            "dangerous_tools": [
                t for t in manifest.capabilities if t == "email.send"
            ],
            "persistent_stores": (
                ["memory"] if manifest.memory else []
            ),
            "sensitive_tools": [
                t for t in manifest.capabilities if t == "email.read"
            ],
            "untrusted_sources": [
                t for t in manifest.capabilities if t == "browser.open_page"
            ],
        },
    )
    _profiles[manifest.agent_id] = profile
    _graphs[manifest.agent_id] = build_attack_graph(manifest)
    return profile


def get_agent(agent_id: str) -> AgentProfile | None:
    """Get agent profile by ID."""
    return _profiles.get(agent_id)


def get_attack_graph(agent_id: str) -> AttackGraph | None:
    """Get generated attack graph for an agent."""
    if agent_id not in _profiles:
        return None
    return _graphs.get(agent_id)