"""RiskMatcher — deterministic pattern matching + severity assignment.

Design V0.2 §11 + plan for 陈书扬 §8 Task S1-3:
  Structure:
    Graph Search (path_finder) → Candidate Path → Pattern Match → Risk Ranking

  Do NOT combine DFS + Risk Rule + Severity in one function.

This module handles:
  1. Pattern Match: filter candidate paths against RiskPattern definitions
  2. Risk Ranking: assign severity based on deterministic rules
"""

from __future__ import annotations

from dataclasses import replace
from typing import Dict, List

from backend.app.attack_graph._types import (
    AttackGraph,
    AttackGraphNode,
    AttackPath,
    RiskPattern,
)


class RiskMatcher:
    """Match candidate attack paths against known risk patterns.

    Usage:
        matcher = RiskMatcher(patterns)
        matched = matcher.match(graph, candidate_paths)
    """

    def __init__(self, patterns: List[RiskPattern]):
        self._patterns = list(patterns)
        self._patterns_by_id: Dict[str, RiskPattern] = {p.id: p for p in patterns}

    def match(
        self,
        graph: AttackGraph,
        candidate_paths: List[AttackPath],
    ) -> List[AttackPath]:
        """Match candidate paths against all risk patterns.

        A path matches a pattern if:
          1. The path's node type sequence matches the pattern's node_pattern
          2. All required labels are present on the corresponding nodes

        Returns:
            List of AttackPath with risk_pattern_id, risk_type, severity, reason filled.
            Only matched paths are returned; unmatched candidates are excluded.
            A single candidate path can produce multiple matches (one per pattern).
        """
        node_map: Dict[str, AttackGraphNode] = {n.node_id: n for n in graph.nodes}
        results: List[AttackPath] = []

        for path in candidate_paths:
            for pattern in self._patterns:
                if self._matches_pattern(path, pattern, node_map):
                    severity = self._compute_severity(pattern)
                    matched_path = replace(
                        path,
                        path_id=f"{path.path_id}_{pattern.id.lower()}",
                        risk_pattern_id=pattern.id,
                        risk_type=pattern.risk_type,
                        severity=severity,
                        description=self._build_reason(path, pattern, node_map),
                    )
                    results.append(matched_path)

        return results

    def _matches_pattern(
        self,
        path: AttackPath,
        pattern: RiskPattern,
        node_map: Dict[str, AttackGraphNode],
    ) -> bool:
        """Check if a path matches a risk pattern.

        Step 1: node type sequence must equal pattern.node_pattern
        Step 2: label_requirements must be satisfied
        """
        # Step 1: type sequence match
        node_types = []
        for nid in path.node_ids:
            node = node_map.get(nid)
            if node is None:
                return False
            node_types.append(node.node_type)

        if node_types != pattern.node_pattern:
            return False

        # Step 2: label requirements
        for node_type, required_labels in pattern.label_requirements.items():
            # Find which position(s) in the pattern have this node_type
            for i, t in enumerate(pattern.node_pattern):
                if t != node_type:
                    continue
                node = node_map.get(path.node_ids[i])
                if node is None:
                    return False
                for label in required_labels:
                    if label not in node.labels:
                        return False

        return True

    @staticmethod
    def _compute_severity(pattern: RiskPattern) -> str:
        """Deterministic severity assignment (security-model.md §5).

        Rules:
          R4 (persistent_indirect_prompt_injection) → CRITICAL
          Everything else that matched                 → HIGH

        Stage 1 simplified rules. Future versions may refine.
        """
        if pattern.risk_type == "persistent_indirect_prompt_injection":
            return "CRITICAL"
        return "HIGH"

    @staticmethod
    def _build_reason(
        path: AttackPath,
        pattern: RiskPattern,
        node_map: Dict[str, AttackGraphNode],
    ) -> str:
        """Build a human-readable reason string for the match."""
        chain = " -> ".join(
            f"{node_map[nid].node_type}({nid})" for nid in path.node_ids if nid in node_map
        )
        return f"Matched {pattern.id} ({pattern.name}): {chain}. {pattern.success_condition}"
