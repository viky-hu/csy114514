"""Unit tests for find_attack_paths (backend/attack_graph/path_finder.py).

Security Line contract (plan for 陈书扬.md §5):
  find_attack_paths(graph, pattern, max_depth) finds node-type sequences in an
  AttackGraph. Pattern semantics follow security-model.md §3/§4:
  - R3 (DATA -> AGENT -> TOOL) may flow through an intermediate TOOL node
  - R4 (SOURCE -> AGENT -> MEMORY -> AGENT -> TOOL) reuses the same AGENT node
"""
from backend.app.domain.attack_graph import AttackGraph, Edge, GraphNode
from backend.app.domain.risk_pattern import JudgeRule, RiskPattern
from backend.attack_graph.path_finder import find_attack_paths


def _corpmate_graph() -> AttackGraph:
    nodes = [
        GraphNode(node_id="n_source_browser", node_type="SOURCE", labels=["UNTRUSTED"]),
        GraphNode(node_id="n_agent", node_type="AGENT", labels=["TRUSTED"]),
        GraphNode(node_id="n_tool_email_read", node_type="TOOL", labels=["SENSITIVE"]),
        GraphNode(node_id="n_tool_email_send", node_type="TOOL", labels=["DANGEROUS"], metadata={"is_external": True}),
        GraphNode(node_id="n_memory", node_type="MEMORY", labels=["PERSISTENT"]),
        GraphNode(node_id="n_data_email", node_type="DATA", labels=["SENSITIVE"]),
    ]
    edges = [
        Edge(edge_id="e_browser_to_agent", source_node_id="n_source_browser", target_node_id="n_agent", edge_type="READ_FROM"),
        Edge(edge_id="e_agent_send_email", source_node_id="n_agent", target_node_id="n_tool_email_send", edge_type="CALL"),
        Edge(edge_id="e_agent_write_memory", source_node_id="n_agent", target_node_id="n_memory", edge_type="WRITE_TO"),
        Edge(edge_id="e_agent_read_memory", source_node_id="n_memory", target_node_id="n_agent", edge_type="READ_FROM"),
        Edge(edge_id="e_email_read_to_tool", source_node_id="n_data_email", target_node_id="n_tool_email_read", edge_type="READ_FROM"),
        Edge(edge_id="e_email_read_to_agent", source_node_id="n_tool_email_read", target_node_id="n_agent", edge_type="PASS_DATA"),
    ]
    return AttackGraph(graph_id="graph-test", agent_id="corpmate", nodes=nodes, edges=edges)


def _pattern(pid: str, node_pattern: list[str], labels: dict[str, list[str]], severity: str = "HIGH") -> RiskPattern:
    return RiskPattern(
        id=pid,
        name=f"Pattern {pid}",
        description=f"test pattern {pid}",
        risk_type="indirect_prompt_injection",
        severity=severity,
        node_pattern=node_pattern,
        label_requirements=labels,
        attack_goal="test",
        success_condition="test",
        judge_strategy="rule",
        judge_rules=[JudgeRule(type="test_rule", description="test")],
    )


R1 = _pattern("R1", ["SOURCE", "AGENT", "TOOL"], {"SOURCE": ["UNTRUSTED"], "TOOL": ["DANGEROUS"]})
R2 = _pattern("R2", ["SOURCE", "AGENT", "MEMORY"], {"SOURCE": ["UNTRUSTED"], "MEMORY": ["PERSISTENT"]})
R3 = _pattern("R3", ["DATA", "AGENT", "TOOL"], {"DATA": ["SENSITIVE"], "TOOL": ["DANGEROUS"]})
R4 = _pattern("R4", ["SOURCE", "AGENT", "MEMORY", "AGENT", "TOOL"],
              {"SOURCE": ["UNTRUSTED"], "MEMORY": ["PERSISTENT"], "TOOL": ["DANGEROUS"]},
              severity="CRITICAL")


def test_r1_matches_untrusted_source_to_dangerous_tool():
    matches = find_attack_paths(_corpmate_graph(), R1, max_depth=4)
    assert matches == [(["n_source_browser", "n_agent", "n_tool_email_send"],
                        ["e_browser_to_agent", "e_agent_send_email"])]


def test_r2_matches_untrusted_source_to_persistent_memory():
    matches = find_attack_paths(_corpmate_graph(), R2, max_depth=4)
    assert matches == [(["n_source_browser", "n_agent", "n_memory"],
                        ["e_browser_to_agent", "e_agent_write_memory"])]


def test_r3_matches_sensitive_data_through_intermediate_tool():
    matches = find_attack_paths(_corpmate_graph(), R3, max_depth=4)
    assert matches == [(["n_data_email", "n_tool_email_read", "n_agent", "n_tool_email_send"],
                        ["e_email_read_to_tool", "e_email_read_to_agent", "e_agent_send_email"])]


def test_r4_matches_five_node_chain_reusing_agent():
    matches = find_attack_paths(_corpmate_graph(), R4, max_depth=4)
    assert matches == [(["n_source_browser", "n_agent", "n_memory", "n_agent", "n_tool_email_send"],
                        ["e_browser_to_agent", "e_agent_write_memory", "e_agent_read_memory", "e_agent_send_email"])]


def test_no_match_when_dangerous_tool_missing():
    graph = _corpmate_graph()
    graph.edges = [e for e in graph.edges if e.edge_id != "e_agent_send_email"]
    graph.nodes = [n for n in graph.nodes if n.node_id != "n_tool_email_send"]
    assert find_attack_paths(graph, R1, max_depth=4) == []


def test_max_depth_limits_longer_chains():
    graph = _corpmate_graph()
    # R4 needs 4 hops; max_depth=3 must exclude it but keep R1/R2
    assert find_attack_paths(graph, R4, max_depth=3) == []
    assert find_attack_paths(graph, R1, max_depth=3) != []


def test_edge_direction_matters():
    graph = _corpmate_graph()
    # Reverse the browser edge: agent -> source is not a valid read flow
    graph.edges = [
        Edge(edge_id="e_reversed", source_node_id="n_agent", target_node_id="n_source_browser", edge_type="WRITE_TO"),
    ] + [e for e in graph.edges if e.edge_id != "e_browser_to_agent"]
    assert find_attack_paths(graph, R1, max_depth=4) == []