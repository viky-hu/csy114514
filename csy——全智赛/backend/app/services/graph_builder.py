"""AttackGraph builder — generate AttackGraph from AgentManifest (P2-0a).

Platform Line responsibility: manifest -> AttackGraph (nodes/edges with security
labels per docs/security-model.md section 3). Risk-path matching
(risk_path_ids) is performed by the Security Line RiskMatcher
(backend/attack_graph/risk_matcher.py) with patterns loaded by the Security KB
loader (backend/knowledge/kb_loader.py).
"""

from __future__ import annotations

from backend.attack_graph.risk_matcher import fill_risk_path_ids
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.attack_graph import AttackGraph, Edge, GraphNode
from backend.knowledge.kb_loader import load_risk_patterns


# Tool semantics: tool name -> (node_type, labels, is_external)
_TOOL_SEMANTICS: dict[str, tuple[str, list[str], bool]] = {
    "browser.open_page": ("SOURCE", ["UNTRUSTED"], False),
    "email.list": ("TOOL", [], False),
    "email.read": ("TOOL", ["SENSITIVE"], False),
    "email.send": ("TOOL", ["DANGEROUS"], True),
    "memory.read": ("MEMORY", ["PERSISTENT"], False),
    "memory.write": ("MEMORY", ["PERSISTENT"], False),
}

# Data source semantics: data source -> (node_type, labels)
_DATA_SOURCE_SEMANTICS: dict[str, tuple[str, list[str]]] = {
    "email": ("DATA", ["SENSITIVE"]),
    "browser": ("SOURCE", ["UNTRUSTED"]),
    "web": ("SOURCE", ["UNTRUSTED"]),
}

_TOOL_DESCRIPTIONS: dict[str, str] = {
    "browser.open_page": "External web content — untrusted, may contain hidden prompts",
    "email.list": "List email inbox — returns email metadata",
    "email.read": "Read corporate emails — may contain sensitive data",
    "email.send": "Send external emails — irreversible external action",
    "memory.read": "Read persistent agent memory — can be poisoned and later retrieved",
    "memory.write": "Write persistent agent memory — can be poisoned and later retrieved",
}


def _node_id_for_tool(tool: str) -> str:
    """Map a tool name to a stable node id (fixture-compatible naming)."""
    if tool == "browser.open_page":
        return "n_source_browser"
    if tool == "email.list":
        return "n_tool_email_list"
    if tool == "email.read":
        return "n_tool_email_read"
    if tool == "email.send":
        return "n_tool_email_send"
    if tool in ("memory.read", "memory.write"):
        return "n_memory_persistent"
    return "n_tool_" + tool.replace(".", "_")


def build_attack_graph(manifest: AgentManifest) -> AttackGraph:
    """Build an AttackGraph from an AgentManifest.

    Node types/labels follow security-model.md section 3: browser content is an
    UNTRUSTED SOURCE, email data is SENSITIVE DATA, email.send is a DANGEROUS
    TOOL, memory is a PERSISTENT MEMORY node. Edges mirror the reference
    CorpMate fixture (shared/fixtures/attack_graph.json).
    """
    agent_node_id = f"n_agent_{manifest.agent_id}"
    nodes: dict[str, GraphNode] = {}
    edges: list[Edge] = []

    nodes[agent_node_id] = GraphNode(
        node_id=agent_node_id,
        node_type="AGENT",
        labels=["TRUSTED"],
        metadata={"name": manifest.name, "description": f"{manifest.name} agent"},
    )

    has_browser_source = False
    has_email_read = False
    has_email_list = False
    has_email_send = False
    has_memory_read = False
    has_memory_write = False

    for tool in manifest.capabilities:
        node_type, labels, is_external = _TOOL_SEMANTICS.get(
            tool, ("TOOL", [], False)
        )
        node_id = _node_id_for_tool(tool)
        if node_id not in nodes:
            metadata: dict = {
                "name": tool,
                "description": _TOOL_DESCRIPTIONS.get(tool, f"{tool} tool"),
            }
            if is_external:
                metadata["is_external"] = True
            nodes[node_id] = GraphNode(
                node_id=node_id,
                node_type=node_type,
                labels=list(labels),
                metadata=metadata,
            )
        if tool == "browser.open_page":
            has_browser_source = True
        elif tool == "email.read":
            has_email_read = True
        elif tool == "email.list":
            has_email_list = True
        elif tool == "email.send":
            has_email_send = True
        elif tool == "memory.read":
            has_memory_read = True
        elif tool == "memory.write":
            has_memory_write = True

    # Data sources (e.g. "email" -> SENSITIVE DATA node).
    for source in manifest.data_sources:
        node_type, labels = _DATA_SOURCE_SEMANTICS.get(source, ("SOURCE", []))
        node_id = "n_data_email" if source == "email" else f"n_source_{source}"
        if node_id not in nodes:
            nodes[node_id] = GraphNode(
                node_id=node_id,
                node_type=node_type,
                labels=list(labels),
                metadata={
                    "name": f"{source} data" if source == "email" else source,
                    "description": (
                        "Email content data — may contain sensitive corporate info"
                        if source == "email"
                        else f"{source} external data source"
                    ),
                },
            )

    def _edge(edge_id: str, src: str, dst: str, edge_type: str, desc: str):
        if src in nodes and dst in nodes:
            edges.append(
                Edge(
                    edge_id=edge_id,
                    source_node_id=src,
                    target_node_id=dst,
                    edge_type=edge_type,
                    metadata={"description": desc},
                )
            )

    if has_browser_source:
        _edge("e_browser_to_agent", "n_source_browser", agent_node_id, "READ_FROM",
              "Agent reads untrusted web content")
    if has_email_list:
        _edge("e_agent_list_email", agent_node_id, "n_tool_email_list", "CALL",
              "Agent lists emails")
    if has_email_read:
        _edge("e_agent_read_email", agent_node_id, "n_tool_email_read", "CALL",
              "Agent reads emails")
    if has_email_send:
        _edge("e_agent_send_email", agent_node_id, "n_tool_email_send", "CALL",
              "Agent sends emails (CONFIRM required)")
    if has_memory_write:
        _edge("e_agent_write_memory", agent_node_id, "n_memory_persistent", "WRITE_TO",
              "Agent writes to persistent memory")
    if has_memory_read:
        _edge("e_agent_read_memory", "n_memory_persistent", agent_node_id, "READ_FROM",
              "Agent reads from persistent memory")
    if has_email_read and "n_data_email" in nodes:
        _edge("e_email_read_to_agent", "n_data_email", "n_tool_email_read", "READ_FROM",
              "Email tool reads email data")
        _edge("e_email_read_data_to_agent", "n_tool_email_read", agent_node_id, "PASS_DATA",
              "Email content passed to agent — may contain malicious prompts or sensitive data")

    graph = AttackGraph(
        graph_id=f"graph-{manifest.agent_id}",
        agent_id=manifest.agent_id,
        nodes=list(nodes.values()),
        edges=edges,
    )
    graph.risk_path_ids = fill_risk_path_ids(graph, load_risk_patterns(), max_depth=4)
    return graph