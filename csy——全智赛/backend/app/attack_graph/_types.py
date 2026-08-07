"""Local type definitions matching backend/app/domain/ (步嘉城 P0-3).

SR0 适配 (2026-08-03): 字段名已对齐 repo 中步嘉城的 Pydantic domain models。
  - node_id / node_type (原 id / type)
  - edge_id / source_node_id / target_node_id / edge_type (原 id / source / target / type)
  - graph_id / agent_id (原 id)
  - path_id / graph_id / description (原 id / 无 / reason)
  - 保留 Security Line 扩展字段: edge_ids, hop_count

Once Pydantic domain models are available in the same package, replace imports:
    from backend.attack_graph._types import ...
becomes:
    from backend.domain import ...
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


# --- Enumerations (frozen in CODING_AGENT_RULE §2.1) ---

NODE_TYPES = ("SOURCE", "AGENT", "TOOL", "MEMORY", "DATA")

NODE_LABELS = ("UNTRUSTED", "TRUSTED", "SENSITIVE", "DANGEROUS", "PERSISTENT")

EDGE_TYPES = ("READ_FROM", "WRITE_TO", "CALL", "PASS_DATA", "CONTROL")

RISK_TYPES = (
    "indirect_prompt_injection",
    "unauthorized_tool_action",
    "memory_poisoning",
    "privacy_leakage",
    "data_exfiltration",
    "persistent_indirect_prompt_injection",
)

SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")


# --- AttackGraph types (aligned with repo domain/attack_graph.py) ---


@dataclass(frozen=True)
class AttackGraphNode:
    """Matches backend.app.domain.attack_graph.GraphNode."""

    node_id: str
    node_type: str  # NODE_TYPES
    labels: List[str] = field(default_factory=list)  # subset of NODE_LABELS
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AttackGraphEdge:
    """Matches backend.app.domain.attack_graph.Edge."""

    edge_id: str
    source_node_id: str  # node_id of source
    target_node_id: str  # node_id of target
    edge_type: str  # EDGE_TYPES
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AttackGraph:
    """Matches backend.app.domain.attack_graph.AttackGraph."""

    graph_id: str
    agent_id: str = ""
    nodes: List[AttackGraphNode] = field(default_factory=list)
    edges: List[AttackGraphEdge] = field(default_factory=list)
    risk_path_ids: List[str] = field(default_factory=list)


# --- AttackPath type (output of find_attack_paths + RiskMatcher) ---


@dataclass
class AttackPath:
    """Matches backend.app.domain.attack_path.AttackPath + Security Line extensions.

    Repo fields:   path_id, graph_id, risk_pattern_id, node_ids, risk_type, severity, description
    Security ext:  edge_ids, hop_count (needed for path analysis)

    Populated in two stages:
      1. find_attack_paths() fills: path_id, graph_id, node_ids, edge_ids, hop_count
      2. RiskMatcher fills: risk_pattern_id, risk_type, severity, description
    """

    path_id: str
    graph_id: str
    node_ids: List[str]
    edge_ids: List[str] = field(default_factory=list)
    hop_count: int = 0
    risk_pattern_id: str | None = None
    risk_type: str | None = None
    severity: str | None = None
    description: str | None = None


# --- RiskPattern type (consumed by RiskMatcher) ---


@dataclass
class RiskPattern:
    """Matches backend.app.domain.risk_pattern.RiskPattern + SECURITY_CONTRACTS §2."""

    id: str
    name: str
    description: str
    risk_type: str
    severity: str
    node_pattern: List[str]
    attack_goal: str
    success_condition: str
    judge_strategy: str
    label_requirements: Dict[str, List[str]] = field(default_factory=dict)
    judge_rules: List[Dict] = field(default_factory=list)
