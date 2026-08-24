"""Topology presets — predefined agent architectures for evaluation.

Provides 3 presets:
  - single: one agent, multiple tools (default, Stage 3 behavior)
  - planner_executor: planner decomposes tasks, executor carries them out
  - rag_agent: retriever fetches from knowledge base, agent processes results
"""
from __future__ import annotations

from backend.app.domain.agent_topology import (
    AgentTopology,
    TopologyEdge,
    TopologyNode,
)

_SINGLE = AgentTopology(
    agent_id="",
    topology_type="single",
    nodes=[
        TopologyNode(id="agent", role="AGENT", trust_boundary="internal"),
    ],
    edges=[],
)

_PLANNER_EXECUTOR = AgentTopology(
    agent_id="",
    topology_type="planner_executor",
    nodes=[
        TopologyNode(id="planner", role="PLANNER", trust_boundary="internal"),
        TopologyNode(
            id="executor",
            role="EXECUTOR",
            trust_boundary="internal",
            tools=["email.send", "memory.write", "browser.open_page"],
        ),
    ],
    edges=[
        TopologyEdge(
            from_node="planner",
            to_node="executor",
            channel="task_plan",
            carries_untrusted_content=True,
        ),
    ],
)

_RAG_AGENT = AgentTopology(
    agent_id="",
    topology_type="rag_agent",
    nodes=[
        TopologyNode(id="retriever", role="RETRIEVER", trust_boundary="internal"),
        TopologyNode(
            id="knowledge_base",
            role="KNOWLEDGE_BASE",
            trust_boundary="external",
        ),
        TopologyNode(
            id="agent",
            role="AGENT",
            trust_boundary="internal",
            tools=["email.send", "memory.write"],
        ),
    ],
    edges=[
        TopologyEdge(
            from_node="knowledge_base",
            to_node="retriever",
            channel="retrieval",
            carries_untrusted_content=True,
        ),
        TopologyEdge(
            from_node="retriever",
            to_node="agent",
            channel="retrieval",
            carries_untrusted_content=True,
        ),
    ],
)

TOPOLOGY_PRESETS: dict[str, AgentTopology] = {
    "single": _SINGLE,
    "planner_executor": _PLANNER_EXECUTOR,
    "rag_agent": _RAG_AGENT,
}

# Human-readable descriptions for each preset
TOPOLOGY_DESCRIPTIONS: dict[str, str] = {
    "single": "Single agent with multiple tools — current standard architecture",
    "planner_executor": "Planner-Executor — task planning separated from execution",
    "rag_agent": "RAG-Agent — retrieval-augmented generation with knowledge base",
}


def get_topology_preset(preset_name: str, agent_id: str) -> AgentTopology:
    """Get a topology preset with the given agent_id filled in.

    Raises ValueError if preset_name is unknown.
    """
    preset = TOPOLOGY_PRESETS.get(preset_name)
    if preset is None:
        raise ValueError(
            f"Unknown topology preset: {preset_name!r}. "
            f"Available: {', '.join(sorted(TOPOLOGY_PRESETS))}"
        )
    return preset.model_copy(update={"agent_id": agent_id})


def list_presets() -> list[dict]:
    """Return summary info for all available presets."""
    results = []
    for name, preset in TOPOLOGY_PRESETS.items():
        results.append({
            "topology_type": name,
            "description": TOPOLOGY_DESCRIPTIONS.get(name, ""),
            "node_count": len(preset.nodes),
            "edge_count": len(preset.edges),
        })
    return results
