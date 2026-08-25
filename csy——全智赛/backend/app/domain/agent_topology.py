"""AgentTopology — 被测 Agent 的拓扑描述 (可选).

New model for Stage 4 topology-aware evaluation.
Does NOT modify AgentManifest (frozen contract #1).

Topology describes the structural architecture of the agent under test:
  - single: one agent with multiple tools (default, current behavior)
  - planner_executor: planner decomposes tasks, executor carries them out
  - rag_agent: retriever fetches from knowledge base, agent processes results

Associated with an AgentManifest via agent_id.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TopologyNode(BaseModel):
    """A logical node in the agent topology."""

    id: str = Field(..., min_length=1, description="Node ID (e.g. 'planner', 'executor')")
    role: str = Field(
        ...,
        min_length=1,
        description="Role: PLANNER|EXECUTOR|RETRIEVER|KNOWLEDGE_BASE|AGENT",
    )
    trust_boundary: str = Field(
        default="internal",
        description="Trust boundary: internal|external",
    )
    tools: list[str] = Field(
        default_factory=list,
        description="Tools available to this node (EXECUTOR/AGENT roles only)",
    )


class TopologyEdge(BaseModel):
    """Data flow between two topology nodes."""

    from_node: str = Field(..., min_length=1, description="Source node ID")
    to_node: str = Field(..., min_length=1, description="Target node ID")
    channel: str = Field(
        default="default",
        description="Channel name: task_plan|retrieval|default",
    )
    carries_untrusted_content: bool = Field(
        default=False,
        description="Whether this edge may carry untrusted content",
    )


class AgentTopology(BaseModel):
    """Optional topology description for an agent under test.

    Linked to an AgentManifest via agent_id.
    When no topology is provided, the system defaults to 'single'
    (equivalent to current Stage 3 behavior).
    """

    agent_id: str = Field(default="", description="Associated Agent ID (empty for presets)")
    topology_type: str = Field(
        ...,
        description="Topology type: single|planner_executor|rag_agent",
    )
    nodes: list[TopologyNode] = Field(default_factory=list)
    edges: list[TopologyEdge] = Field(default_factory=list)
