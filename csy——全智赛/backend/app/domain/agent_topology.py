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

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TopologyNode(BaseModel):
    """A logical node in the agent topology."""

    id: str = Field(..., min_length=1, description="Node ID (e.g. 'planner', 'executor')")
    model_config = ConfigDict(extra="forbid")

    role: Literal["PLANNER", "EXECUTOR", "RETRIEVER", "KNOWLEDGE_BASE", "AGENT"] = Field(
        ...,
        min_length=1,
        description="Role: PLANNER|EXECUTOR|RETRIEVER|KNOWLEDGE_BASE|AGENT",
    )
    trust_boundary: Literal["internal", "external"] = Field(
        default="internal",
        description="Trust boundary: internal|external",
    )
    tools: list[str] = Field(
        default_factory=list,
        description="Tools available to this node (EXECUTOR/AGENT roles only)",
    )


class TopologyEdge(BaseModel):
    """Data flow between two topology nodes."""

    model_config = ConfigDict(extra="forbid")

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

    model_config = ConfigDict(extra="forbid")

    agent_id: str = Field(default="", description="Associated Agent ID (empty for presets)")
    topology_type: Literal["single", "planner_executor", "rag_agent"] = Field(
        ...,
        description="Topology type: single|planner_executor|rag_agent",
    )
    nodes: list[TopologyNode] = Field(default_factory=list)
    edges: list[TopologyEdge] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_graph_integrity(self) -> "AgentTopology":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("topology contains duplicate node ids")
        known_nodes = set(node_ids)
        for edge in self.edges:
            unknown = {edge.from_node, edge.to_node} - known_nodes
            if unknown:
                raise ValueError(
                    "topology edge references unknown node(s): "
                    + ", ".join(sorted(unknown))
                )
        return self
