"""find_attack_paths — graph search for candidate attack paths.

Design V0.2 §10 + plan for 陈书扬 §8 Task S1-2:
  - max_depth is a config parameter, NOT hardcoded to 4
  - Must handle: 2-hop, 4-hop, 5-hop rejection, cycle, multiple paths, no path

Algorithm:
  1. Build NetworkX DiGraph from AttackGraph
  2. Identify entry nodes (SOURCE, DATA) as starting points
  3. Find all simple paths from entry nodes to all reachable nodes, up to max_depth edges
  4. Return candidate paths for RiskMatcher to filter
"""

from __future__ import annotations

import uuid
from typing import List

import networkx as nx

from backend.app.attack_graph._types import (
    AttackGraph,
    AttackGraphEdge,
    AttackGraphNode,
    AttackPath,
)

# Node types that can serve as path entry points
_ENTRY_NODE_TYPES = frozenset({"SOURCE", "DATA"})


def build_digraph(graph: AttackGraph) -> nx.DiGraph:
    """Convert AttackGraph to a NetworkX DiGraph.

    Node attributes:
      node_type: str (SOURCE / AGENT / TOOL / MEMORY / DATA)
      labels:    list[str]

    Edge attributes:
      edge_id:   str
      edge_type: str (READ_FROM / WRITE_TO / CALL / PASS_DATA / CONTROL)
    """
    dg = nx.DiGraph()
    for node in graph.nodes:
        dg.add_node(node.node_id, node_type=node.node_type, labels=list(node.labels))
    for edge in graph.edges:
        dg.add_edge(
            edge.source_node_id, edge.target_node_id,
            edge_id=edge.edge_id, edge_type=edge.edge_type,
        )
    return dg


def find_attack_paths(
    graph: AttackGraph,
    max_depth: int = 4,
) -> List[AttackPath]:
    """Find all simple paths up to max_depth edges starting from entry nodes.

    Entry nodes are nodes with type SOURCE or DATA.
    A simple path visits each node at most once (cycles are naturally excluded).

    Args:
        graph:     The AttackGraph to search.
        max_depth: Maximum number of edges (hops) in a path. Default 4.

    Returns:
        List of AttackPath with id, node_ids, edge_ids, hop_count populated.
        risk_pattern_id / risk_type / severity / reason are left None
        for RiskMatcher to fill.
    """
    if max_depth < 1:
        raise ValueError("max_depth must be >= 1")

    dg = build_digraph(graph)

    # Build lookup maps
    node_map: dict[str, AttackGraphNode] = {n.node_id: n for n in graph.nodes}
    edge_lookup: dict[tuple[str, str], AttackGraphEdge] = {
        (e.source_node_id, e.target_node_id): e for e in graph.edges
    }

    # Identify entry nodes
    entry_nodes = [
        nid for nid, attrs in dg.nodes(data=True) if attrs.get("node_type") in _ENTRY_NODE_TYPES
    ]

    if not entry_nodes:
        return []

    paths: List[AttackPath] = []

    for source in entry_nodes:
        # nx.all_simple_paths uses cutoff = max number of edges
        for node_id_list in nx.all_simple_paths(dg, source, dg.nodes, cutoff=max_depth):
            # Only include paths with at least 2 nodes (1 edge)
            if len(node_id_list) < 2:
                continue

            # Collect edge IDs along this path
            edge_ids: list[str] = []
            for i in range(len(node_id_list) - 1):
                key = (node_id_list[i], node_id_list[i + 1])
                edge = edge_lookup.get(key)
                if edge is None:
                    break
                edge_ids.append(edge.edge_id)

            # Skip if we couldn't resolve all edges (shouldn't happen with valid graph)
            if len(edge_ids) != len(node_id_list) - 1:
                continue

            paths.append(
                AttackPath(
                    path_id=f"path_{uuid.uuid4().hex[:8]}",
                    graph_id=graph.graph_id,
                    node_ids=list(node_id_list),
                    edge_ids=edge_ids,
                    hop_count=len(node_id_list) - 1,
                )
            )

    return paths
