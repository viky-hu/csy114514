"""Unit tests for find_attack_paths.

Covers plan for 陈书扬 §8 Task S1-2 required scenarios:
  - 2-hop valid
  - 4-hop valid
  - 5-hop rejected (beyond max_depth=4)
  - cycle handling
  - multiple paths
  - no path
"""

import pytest

from backend.app.attack_graph._types import (
    AttackGraph,
    AttackGraphEdge,
    AttackGraphNode,
)
from backend.app.attack_graph.path_finder import find_attack_paths


# --- Helpers ---


def _make_graph(nodes: list[tuple], edges: list[tuple]) -> AttackGraph:
    """Build an AttackGraph from compact tuple notation.

    nodes: [(id, type, [labels]), ...]
    edges: [(source, target, type), ...]
    """
    graph_nodes = []
    for n in nodes:
        nid, ntype = n[0], n[1]
        labels = n[2] if len(n) > 2 else []
        graph_nodes.append(AttackGraphNode(node_id=nid, node_type=ntype, labels=labels))

    graph_edges = []
    for i, e in enumerate(edges):
        graph_edges.append(
            AttackGraphEdge(edge_id=f"e{i}", source_node_id=e[0], target_node_id=e[1], edge_type=e[2])
        )

    return AttackGraph(graph_id="test_graph", nodes=graph_nodes, edges=graph_edges)


def _path_node_types(paths):
    """Extract node type sequences from paths for easy assertion."""
    # Returns list of tuples like [("SOURCE", "AGENT", "TOOL"), ...]
    # We need the graph to look up types, so this helper works with path.node_ids
    return [tuple(p.node_ids) for p in paths]


# --- Tests ---


class TestFindAttackPaths:
    """Test find_attack_paths with various graph topologies."""

    def test_2hop_valid(self):
        """R1 pattern: SOURCE → AGENT → TOOL (2 hops)."""
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
        paths = find_attack_paths(graph, max_depth=4)
        # find_attack_paths returns ALL simple paths including sub-paths
        node_seqs = [tuple(p.node_ids) for p in paths]
        assert ("web", "agent", "email_send") in node_seqs
        # Verify the 2-hop path specifically
        full = [p for p in paths if p.node_ids == ["web", "agent", "email_send"]][0]
        assert full.hop_count == 2
        assert full.edge_ids == ["e0", "e1"]
        assert full.risk_pattern_id is None  # Not yet matched

    def test_4hop_valid(self):
        """4-hop path: SOURCE → AGENT → MEMORY → AGENT → TOOL."""
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
        paths = find_attack_paths(graph, max_depth=4)
        # Should find multiple sub-paths AND the full 4-hop path
        full_paths = [p for p in paths if p.hop_count == 4]
        assert len(full_paths) == 1
        p = full_paths[0]
        assert p.node_ids == ["web", "agent1", "memory", "agent2", "email_send"]
        assert p.hop_count == 4
        assert len(p.edge_ids) == 4

    def test_5hop_rejected(self):
        """Paths exceeding max_depth=4 must not appear."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent1", "AGENT"),
                ("memory", "MEMORY", ["PERSISTENT"]),
                ("agent2", "AGENT"),
                ("data", "DATA", ["SENSITIVE"]),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent1", "READ_FROM"),
                ("agent1", "memory", "WRITE_TO"),
                ("memory", "agent2", "READ_FROM"),
                ("agent2", "data", "READ_FROM"),
                ("data", "email_send", "PASS_DATA"),
            ],
        )
        paths_4 = find_attack_paths(graph, max_depth=4)
        # The 5-hop path (web→agent1→memory→agent2→data→email_send) must NOT appear
        for p in paths_4:
            assert p.hop_count <= 4

        # With max_depth=5, it should appear
        paths_5 = find_attack_paths(graph, max_depth=5)
        full_paths = [p for p in paths_5 if p.hop_count == 5]
        assert len(full_paths) == 1

    def test_cycle_handling(self):
        """Cycles must not cause infinite loops; simple paths only."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("memory", "MEMORY", ["PERSISTENT"]),
                ("tool", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "memory", "WRITE_TO"),
                ("memory", "agent", "READ_FROM"),  # cycle: agent ↔ memory
                ("agent", "tool", "CALL"),
            ],
        )
        # Should not hang; simple paths exclude revisiting nodes
        paths = find_attack_paths(graph, max_depth=4)
        # Verify no path visits the same node twice
        for p in paths:
            assert len(p.node_ids) == len(set(p.node_ids)), f"Cycle in path: {p.node_ids}"

        # Should find web → agent → tool (2-hop)
        short_paths = [p for p in paths if p.node_ids == ["web", "agent", "tool"]]
        assert len(short_paths) == 1

        # Should find web → agent → memory (2-hop)
        mem_paths = [p for p in paths if p.node_ids == ["web", "agent", "memory"]]
        assert len(mem_paths) == 1

    def test_multiple_paths(self):
        """Graph with multiple valid paths from the same source."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
                ("memory", "MEMORY", ["PERSISTENT"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "email_send", "CALL"),
                ("agent", "memory", "WRITE_TO"),
            ],
        )
        paths = find_attack_paths(graph, max_depth=4)
        # Should find: web→agent→email_send AND web→agent→memory (plus sub-paths)
        node_seqs = [tuple(p.node_ids) for p in paths]
        assert ("web", "agent", "email_send") in node_seqs
        assert ("web", "agent", "memory") in node_seqs
        # At least 3 paths: sub-path (web→agent) + two 2-hop paths
        assert len(paths) >= 3

    def test_no_path(self):
        """Disconnected graph — no paths from entry nodes."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("tool", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                # No edge from web to agent — disconnected
                ("agent", "tool", "CALL"),
            ],
        )
        paths = find_attack_paths(graph, max_depth=4)
        assert len(paths) == 0

    def test_no_entry_nodes(self):
        """Graph with no SOURCE or DATA nodes."""
        graph = _make_graph(
            nodes=[
                ("agent", "AGENT"),
                ("tool", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("agent", "tool", "CALL"),
            ],
        )
        paths = find_attack_paths(graph, max_depth=4)
        assert len(paths) == 0

    def test_single_node_graph(self):
        """Graph with only one node — no paths possible."""
        graph = _make_graph(
            nodes=[("web", "SOURCE", ["UNTRUSTED"])],
            edges=[],
        )
        paths = find_attack_paths(graph, max_depth=4)
        assert len(paths) == 0

    def test_max_depth_1(self):
        """max_depth=1 should only return 1-hop paths."""
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("tool", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "tool", "CALL"),
            ],
        )
        paths = find_attack_paths(graph, max_depth=1)
        assert len(paths) == 1
        assert paths[0].node_ids == ["web", "agent"]
        assert paths[0].hop_count == 1

    def test_data_entry_node(self):
        """DATA nodes should also serve as entry points (for R3 pattern)."""
        graph = _make_graph(
            nodes=[
                ("financial_data", "DATA", ["SENSITIVE"]),
                ("agent", "AGENT"),
                ("email_send", "TOOL", ["DANGEROUS"]),
            ],
            edges=[
                ("financial_data", "agent", "READ_FROM"),
                ("agent", "email_send", "CALL"),
            ],
        )
        paths = find_attack_paths(graph, max_depth=4)
        node_seqs = [tuple(p.node_ids) for p in paths]
        assert ("financial_data", "agent", "email_send") in node_seqs

    def test_invalid_max_depth(self):
        """max_depth < 1 should raise ValueError."""
        graph = _make_graph(nodes=[], edges=[])
        with pytest.raises(ValueError):
            find_attack_paths(graph, max_depth=0)

    def test_corpmate_full_graph(self):
        """Full CorpMate graph matching the flagship R4 scenario.

        Web → Agent → Memory → Agent → Email
        Also includes email_read and memory_read for realistic topology.
        """
        graph = _make_graph(
            nodes=[
                ("web", "SOURCE", ["UNTRUSTED"]),
                ("agent", "AGENT"),
                ("email_list", "TOOL"),
                ("email_read", "TOOL", ["SENSITIVE"]),
                ("email_send", "TOOL", ["DANGEROUS"]),
                ("memory_write", "MEMORY", ["PERSISTENT"]),
                ("memory_read", "MEMORY", ["PERSISTENT"]),
            ],
            edges=[
                ("web", "agent", "READ_FROM"),
                ("agent", "email_list", "CALL"),
                ("agent", "email_read", "CALL"),
                ("agent", "email_send", "CALL"),
                ("agent", "memory_write", "WRITE_TO"),
                ("memory_read", "agent", "READ_FROM"),
                ("email_read", "agent", "PASS_DATA"),
            ],
        )
        paths = find_attack_paths(graph, max_depth=4)
        # Should find many paths; verify key ones exist
        node_seqs = [tuple(p.node_ids) for p in paths]

        # R1: web → agent → email_send
        assert ("web", "agent", "email_send") in node_seqs

        # R2: web → agent → memory_write
        assert ("web", "agent", "memory_write") in node_seqs

        # R4: web → agent → memory_write is 2-hop, but full R4 needs:
        # SOURCE → AGENT → MEMORY → AGENT → TOOL
        # In this graph, memory_read → agent → email_send is a 2-hop from MEMORY
        # But we need a single path: web → agent → memory_write (2 hops)
        # The 4-hop R4 chain would require memory_write and memory_read to be connected
        # or memory_write == memory_read conceptually. This tests the graph search only.

        # Verify all paths have hop_count <= 4
        for p in paths:
            assert p.hop_count <= 4
