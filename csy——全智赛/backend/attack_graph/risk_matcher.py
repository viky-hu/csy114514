"""RiskMatcher — match RiskPattern[] against an AttackGraph (Security Line).

Contract (plan for 陈书扬.md §5):
  input  AttackGraph + RiskPattern[] + max_depth
  output AttackPath[] with path_id / node_ids / edge_ids / risk_pattern_id /
         risk_type / severity / description

Severity is deterministic (security-model.md §5): R1/R2/R3 -> HIGH,
R4 -> CRITICAL; the pattern's severity field is the single source.
"""
from __future__ import annotations

from backend.app.domain.attack_graph import AttackGraph
from backend.app.domain.attack_path import AttackPath
from backend.app.domain.risk_pattern import RiskPattern
from backend.attack_graph.path_finder import find_attack_paths


def match_risk_patterns(
    graph: AttackGraph, patterns: list[RiskPattern], max_depth: int = 4
) -> list[AttackPath]:
    """Match every pattern against the graph; one AttackPath per route."""
    attack_paths: list[AttackPath] = []
    for pattern in patterns:
        for index, (node_ids, edge_ids) in enumerate(
            find_attack_paths(graph, pattern, max_depth), start=1
        ):
            attack_paths.append(
                AttackPath(
                    path_id=f"path-{pattern.id}-{graph.graph_id}-{index}",
                    graph_id=graph.graph_id,
                    risk_pattern_id=pattern.id,
                    node_ids=node_ids,
                    edge_ids=edge_ids,
                    hop_count=len(edge_ids),
                    risk_type=pattern.risk_type,
                    severity=pattern.severity,
                    description=f"{pattern.name}: {pattern.description}",
                )
            )
    return attack_paths


def fill_risk_path_ids(
    graph: AttackGraph, patterns: list[RiskPattern], max_depth: int = 4
) -> list[str]:
    """Deduplicated matched pattern IDs, preserving pattern order."""
    matched: list[str] = []
    for pattern in patterns:
        if pattern.id not in matched and find_attack_paths(graph, pattern, max_depth):
            matched.append(pattern.id)
    return matched