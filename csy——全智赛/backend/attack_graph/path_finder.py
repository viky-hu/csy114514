"""Path finder — find node-type sequences in an AttackGraph (Security Line).

Security Line contract (plan for 陈书扬.md §5): find_attack_paths() searches an
AttackGraph for routes whose node types/labels match a RiskPattern.node_pattern
as a subsequence:

  - intermediate nodes are allowed between pattern positions (e.g. R3's
    DATA -> AGENT flow passes through the email.read TOOL node);
  - the same node may be reused across pattern positions (R4's five-node chain
    re-enters the same AGENT node).

Matching is deterministic (pure graph search, no LLM). The returned route
contains every node/edge on the path so RiskMatcher can attach Evidence.
"""
from __future__ import annotations

from backend.app.domain.attack_graph import AttackGraph, Edge, GraphNode
from backend.app.domain.risk_pattern import RiskPattern

PathMatch = tuple[list[str], list[str]]


def _node_matches(node: GraphNode, node_type: str, required_labels: list[str]) -> bool:
    """Node matches pattern position: same node_type and all labels present."""
    if node.node_type != node_type:
        return False
    return all(label in node.labels for label in required_labels)


def find_attack_paths(
    graph: AttackGraph, pattern: RiskPattern, max_depth: int
) -> list[PathMatch]:
    """Find all routes matching a RiskPattern within max_depth hops.

    Returns (node_ids, edge_ids) covering the full route, including any
    intermediate nodes between matched pattern positions.
    """
    node_types = pattern.node_pattern
    label_requirements = pattern.label_requirements
    node_map = {n.node_id: n for n in graph.nodes}
    adjacency: dict[str, list[Edge]] = {}
    for edge in graph.edges:
        adjacency.setdefault(edge.source_node_id, []).append(edge)

    def _matches_pos(node: GraphNode, pos: int) -> bool:
        return _node_matches(
            node, node_types[pos], label_requirements.get(node_types[pos], [])
        )

    results: list[PathMatch] = []
    seen: set[tuple[tuple[str, ...], tuple[str, ...]]] = set()

    def _dfs(node_id: str, route_nodes: list[str], route_edges: list[str], matched_idx: int) -> None:
        if matched_idx == len(node_types):
            key = (tuple(route_nodes), tuple(route_edges))
            if key not in seen:
                seen.add(key)
                results.append((list(route_nodes), list(route_edges)))
            return
        if len(route_edges) >= max_depth:
            return
        for edge in adjacency.get(node_id, []):
            nxt = node_map.get(edge.target_node_id)
            if nxt is None:
                continue
            route_nodes.append(nxt.node_id)
            route_edges.append(edge.edge_id)
            if _matches_pos(nxt, matched_idx):
                _dfs(nxt.node_id, route_nodes, route_edges, matched_idx + 1)
            _dfs(nxt.node_id, route_nodes, route_edges, matched_idx)
            route_nodes.pop()
            route_edges.pop()

    for node in graph.nodes:
        if _matches_pos(node, 0):
            _dfs(node.node_id, [node.node_id], [], 1)

    # Return only minimal routes: an R1/R2/R3/R4 match is the shortest chain
    # that satisfies the pattern (a longer detour is reported by its own
    # pattern, e.g. the R4 chain must not be double-reported as R1).
    if results:
        min_hops = min(len(edge_ids) for _, edge_ids in results)
        results = [r for r in results if len(r[1]) == min_hops]
    return results