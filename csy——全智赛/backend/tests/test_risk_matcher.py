"""Unit tests for RiskMatcher.

Covers:
  - R1 match (SOURCE → AGENT → TOOL)
  - R2 match (SOURCE → AGENT → MEMORY)
  - R3 match (DATA → AGENT → TOOL)
  - R4 match (SOURCE → AGENT → MEMORY → AGENT → TOOL) — flagship
  - No match scenarios
  - Label requirement enforcement
  - Severity assignment (CRITICAL for R4, HIGH for others)
  - Multiple pattern matches on same graph
"""

import pytest

from backend.app.attack_graph._types import (
    AttackGraph,
    AttackGraphEdge,
    AttackGraphNode,
    AttackPath,
    RiskPattern,
)
from backend.app.attack_graph.path_finder import find_attack_paths
from backend.app.attack_graph.risk_matcher import RiskMatcher
from backend.app.knowledge.kb_loader import load_risk_patterns


# --- Fixtures ---


@pytest.fixture
def patterns() -> list[RiskPattern]:
    """Load real risk patterns from shared/examples/security/."""
    return load_risk_patterns()


@pytest.fixture
def matcher(patterns) -> RiskMatcher:
    return RiskMatcher(patterns)


def _make_graph(nodes, edges) -> AttackGraph:
    """Build AttackGraph from compact tuple notation."""
    graph_nodes = []
    for n in nodes:
        nid, ntype = n[0], n[1]
        labels = n[2] if len(n) > 2 else []
        graph_nodes.append(AttackGraphNode(node_id=nid, node_type=ntype, labels=labels))
    graph_edges = []
    for i, e in enumerate(edges):
        graph_edges.append(AttackGraphEdge(edge_id=f"e{i}", source_node_id=e[0], target_node_id=e[1], edge_type=e[2]))
    return AttackGraph(graph_id="test", nodes=graph_nodes, edges=graph_edges)


# --- Tests ---


class TestRiskMatcherR1:
    """R1: SOURCE(UNTRUSTED) → AGENT → TOOL(DANGEROUS)."""

    def test_r1_match(self, matcher):
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "email_send", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)

        r1_matches = [m for m in matched if m.risk_pattern_id == "R1"]
        assert len(r1_matches) == 1
        m = r1_matches[0]
        assert m.risk_type == "indirect_prompt_injection"
        assert m.severity == "HIGH"
        assert m.description is not None and "R1" in m.description

    def test_r1_no_match_missing_label(self, matcher):
        """SOURCE without UNTRUSTED label should not match R1."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE"),  # No UNTRUSTED label
                ("agent", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "email_send", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)
        r1_matches = [m for m in matched if m.risk_pattern_id == "R1"]
        assert len(r1_matches) == 0

    def test_r1_no_match_tool_not_dangerous(self, matcher):
        """TOOL without DANGEROUS label should not match R1."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("email_list", "TOOL"),  # No DANGEROUS label
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "email_list", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)
        r1_matches = [m for m in matched if m.risk_pattern_id == "R1"]
        assert len(r1_matches) == 0


class TestRiskMatcherR2:
    """R2: SOURCE(UNTRUSTED) → AGENT → MEMORY(PERSISTENT)."""

    def test_r2_match(self, matcher):
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("memory", "MEMORY", ["PERSISTENT"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "memory", "WRITE_TO"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)

        r2_matches = [m for m in matched if m.risk_pattern_id == "R2"]
        assert len(r2_matches) == 1
        m = r2_matches[0]
        assert m.risk_type == "memory_poisoning"
        assert m.severity == "HIGH"

    def test_r2_no_match_memory_not_persistent(self, matcher):
        """MEMORY without PERSISTENT label should not match R2."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("memory", "MEMORY"),  # No PERSISTENT
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "memory", "WRITE_TO"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)
        r2_matches = [m for m in matched if m.risk_pattern_id == "R2"]
        assert len(r2_matches) == 0


class TestRiskMatcherR3:
    """R3: DATA(SENSITIVE) → AGENT → TOOL(DANGEROUS)."""

    def test_r3_match(self, matcher):
        graph = _make_graph(
            nodes=[
                ("financial", "DATA", ["SENSITIVE"]),
                ("agent", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("financial", "agent", "READ_FROM"),
                ("agent", "email_send", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)

        r3_matches = [m for m in matched if m.risk_pattern_id == "R3"]
        assert len(r3_matches) == 1
        m = r3_matches[0]
        assert m.risk_type == "privacy_leakage"
        assert m.severity == "HIGH"


class TestRiskMatcherR4:
    """R4: SOURCE(UNTRUSTED) → AGENT → MEMORY(PERSISTENT) → AGENT → TOOL(DANGEROUS).
    Flagship pattern — severity must be CRITICAL.
    """

    def test_r4_match_flagship(self, matcher):
        """Full CorpMate chain: Web → Agent → Memory → Agent → Email."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent1", "AGENT"),
                ("memory", "MEMORY", ["PERSISTENT"]),
                ("agent2", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent1", "READ_FROM"),
                ("agent1", "memory", "WRITE_TO"),
                ("memory", "agent2", "READ_FROM"),
                ("agent2", "email_send", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)

        r4_matches = [m for m in matched if m.risk_pattern_id == "R4"]
        assert len(r4_matches) == 1
        m = r4_matches[0]
        assert m.risk_type == "persistent_indirect_prompt_injection"
        assert m.severity == "CRITICAL"
        assert m.hop_count == 4

    def test_r4_also_matches_subpatterns(self, matcher):
        """R4 graph should also match R1 and R2 as sub-patterns."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent1", "AGENT"),
                ("memory", "MEMORY", ["PERSISTENT"]),
                ("agent2", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent1", "READ_FROM"),
                ("agent1", "memory", "WRITE_TO"),
                ("memory", "agent2", "READ_FROM"),
                ("agent2", "email_send", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)

        pattern_ids = {m.risk_pattern_id for m in matched}
        # R1 (web→agent1→... no, R1 needs SOURCE→AGENT→TOOL, and email_send is 4 hops away)
        # R2 should match: web→agent1→memory (SOURCE→AGENT→MEMORY)
        assert "R2" in pattern_ids
        # R4 should match the full chain
        assert "R4" in pattern_ids

    def test_r4_rejected_when_hop_exceeds_max_depth(self, matcher):
        """5-node chain with max_depth=3 should not produce R4."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent1", "AGENT"),
                ("memory", "MEMORY", ["PERSISTENT"]),
                ("agent2", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent1", "READ_FROM"),
                ("agent1", "memory", "WRITE_TO"),
                ("memory", "agent2", "READ_FROM"),
                ("agent2", "email_send", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=3)
        matched = matcher.match(graph, candidates)
        r4_matches = [m for m in matched if m.risk_pattern_id == "R4"]
        assert len(r4_matches) == 0


class TestRiskMatcherNoMatch:
    """Scenarios where no pattern should match."""

    def test_benign_graph(self, matcher):
        """Graph with no dangerous tools or untrusted sources."""
        graph = _make_graph(
            nodes=[
                ("user", "SOURCE", ["TRUSTED"]),
                ("agent", "AGENT"),
                ("email_list", "TOOL"),
            ],
            edges=[
                ("user", "agent", "READ_FROM"),
                ("agent", "email_list", "CALL"),
            ],
        )
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)
        # TRUSTED source should not match R1 (requires UNTRUSTED)
        # email_list is not DANGEROUS
        assert len(matched) == 0

    def test_empty_graph(self, matcher):
        graph = AttackGraph(graph_id="empty", nodes=[], edges=[])
        candidates = find_attack_paths(graph, max_depth=4)
        matched = matcher.match(graph, candidates)
        assert len(matched) == 0


class TestSeverity:
    """Severity assignment rules."""

    def test_r4_is_critical(self, patterns):
        r4 = [p for p in patterns if p.id == "R4"][0]
        m = RiskMatcher(patterns)
        assert m._compute_severity(r4) == "CRITICAL"

    def test_r1_r2_r3_are_high(self, patterns):
        m = RiskMatcher(patterns)
        for pid in ["R1", "R2", "R3"]:
            p = [p for p in patterns if p.id == pid][0]
            assert m._compute_severity(p) == "HIGH"
