"""Tests for manifest -> AttackGraph builder (P2-0a)."""
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.services.graph_builder import build_attack_graph


CORPMATE_MANIFEST = AgentManifest(
    agent_id="corpmate-v0",
    name="CorpMate v0",
    version="0.1.0",
    capabilities=[
        "chat",
        "browser.open_page",
        "email.list",
        "email.read",
        "email.send",
        "memory.read",
        "memory.write",
    ],
    data_sources=["browser", "email"],
    memory={"type": "persistent"},
    tool_permissions={
        "browser.open_page": "ALLOW",
        "email.send": "CONFIRM",
    },
)


def _node(graph, node_id):
    return next(n for n in graph.nodes if n.node_id == node_id)


def test_build_corpmate_graph_has_expected_nodes():
    graph = build_attack_graph(CORPMATE_MANIFEST)
    assert graph.agent_id == "corpmate-v0"
    assert graph.graph_id == "graph-corpmate-v0"

    assert _node(graph, "n_agent_corpmate-v0").node_type == "AGENT"
    assert "TRUSTED" in _node(graph, "n_agent_corpmate-v0").labels

    browser = _node(graph, "n_source_browser")
    assert browser.node_type == "SOURCE"
    assert browser.labels == ["UNTRUSTED"]

    email_read = _node(graph, "n_tool_email_read")
    assert email_read.node_type == "TOOL"
    assert email_read.labels == ["SENSITIVE"]

    email_list = _node(graph, "n_tool_email_list")
    assert email_list.node_type == "TOOL"
    assert email_list.labels == []

    email_send = _node(graph, "n_tool_email_send")
    assert email_send.node_type == "TOOL"
    assert email_send.labels == ["DANGEROUS"]
    assert email_send.metadata.get("is_external") is True

    memory = _node(graph, "n_memory_persistent")
    assert memory.node_type == "MEMORY"
    assert memory.labels == ["PERSISTENT"]

    email_data = _node(graph, "n_data_email")
    assert email_data.node_type == "DATA"
    assert email_data.labels == ["SENSITIVE"]


def test_build_corpmate_graph_has_expected_edges():
    graph = build_attack_graph(CORPMATE_MANIFEST)
    edge_types = {(e.edge_id, e.source_node_id, e.target_node_id, e.edge_type) for e in graph.edges}

    assert ("e_browser_to_agent", "n_source_browser", "n_agent_corpmate-v0", "READ_FROM") in edge_types
    assert ("e_agent_read_email", "n_agent_corpmate-v0", "n_tool_email_read", "CALL") in edge_types
    assert ("e_agent_send_email", "n_agent_corpmate-v0", "n_tool_email_send", "CALL") in edge_types
    assert ("e_agent_write_memory", "n_agent_corpmate-v0", "n_memory_persistent", "WRITE_TO") in edge_types
    assert ("e_agent_read_memory", "n_memory_persistent", "n_agent_corpmate-v0", "READ_FROM") in edge_types
    assert ("e_email_read_to_agent", "n_data_email", "n_tool_email_read", "READ_FROM") in edge_types
    assert ("e_email_read_data_to_agent", "n_tool_email_read", "n_agent_corpmate-v0", "PASS_DATA") in edge_types


def test_unknown_tool_becomes_plain_tool_node():
    manifest = AgentManifest(
        agent_id="simple",
        name="Simple",
        capabilities=["chat", "some.custom.tool"],
        data_sources=[],
    )
    graph = build_attack_graph(manifest)
    tool = _node(graph, "n_tool_some_custom_tool")
    assert tool.node_type == "TOOL"
    assert tool.labels == []


def test_no_memory_tools_produce_no_memory_node():
    manifest = AgentManifest(
        agent_id="no-mem",
        name="NoMem",
        capabilities=["email.read"],
        data_sources=["email"],
    )
    graph = build_attack_graph(manifest)
    assert all(n.node_type != "MEMORY" for n in graph.nodes)


def test_risk_path_ids_empty_until_risk_matcher_lands():
    graph = build_attack_graph(CORPMATE_MANIFEST)
    assert graph.risk_path_ids == []


def test_edges_only_reference_existing_nodes():
    graph = build_attack_graph(CORPMATE_MANIFEST)
    node_ids = {n.node_id for n in graph.nodes}
    for e in graph.edges:
        assert e.source_node_id in node_ids
        assert e.target_node_id in node_ids