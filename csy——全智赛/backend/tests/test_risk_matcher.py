"""Unit tests for RiskMatcher (backend/attack_graph/risk_matcher.py).

Contract (plan for 陈书扬.md §5): RiskMatcher takes AttackGraph + RiskPattern[]
+ max_depth and outputs AttackPath[] with id/node_ids/edge_ids/risk_pattern_id/
risk_type/severity/reason(description).
"""
from backend.app.domain.attack_graph import AttackGraph, Edge, GraphNode
from backend.app.domain.risk_pattern import JudgeRule, RiskPattern
from backend.attack_graph.risk_matcher import fill_risk_path_ids, match_risk_patterns


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


def test_match_risk_patterns_returns_all_four_corpmate_paths():
    paths = match_risk_patterns(_corpmate_graph(), [R1, R2, R3, R4], max_depth=4)
    assert [p.risk_pattern_id for p in paths] == ["R1", "R2", "R3", "R4"]
    by_id = {p.risk_pattern_id: p for p in paths}
    assert by_id["R4"].severity == "CRITICAL"
    assert by_id["R1"].severity == "HIGH"
    assert by_id["R4"].hop_count == 4
    assert by_id["R3"].hop_count == 3
    assert by_id["R4"].node_ids == ["n_source_browser", "n_agent", "n_memory", "n_agent", "n_tool_email_send"]
    assert by_id["R4"].edge_ids == ["e_browser_to_agent", "e_agent_write_memory", "e_agent_read_memory", "e_agent_send_email"]


def test_attack_path_fields_follow_contract():
    paths = match_risk_patterns(_corpmate_graph(), [R4], max_depth=4)
    assert len(paths) == 1
    p = paths[0]
    assert p.path_id.startswith("path-R4-")
    assert p.graph_id == "graph-test"
    assert p.risk_pattern_id == "R4"
    assert p.risk_type == "indirect_prompt_injection"
    assert p.description != ""


def test_path_ids_unique_across_patterns():
    paths = match_risk_patterns(_corpmate_graph(), [R1, R2, R3, R4], max_depth=4)
    ids = [p.path_id for p in paths]
    assert len(ids) == len(set(ids))


def test_fill_risk_path_ids_dedupes_in_pattern_order():
    graph = _corpmate_graph()
    assert fill_risk_path_ids(graph, [R1, R2, R3, R4], max_depth=4) == ["R1", "R2", "R3", "R4"]
    assert fill_risk_path_ids(graph, [R4, R1, R4], max_depth=4) == ["R4", "R1"]


def test_no_patterns_returns_empty():
    assert match_risk_patterns(_corpmate_graph(), [], max_depth=4) == []
    assert fill_risk_path_ids(_corpmate_graph(), [], max_depth=4) == []