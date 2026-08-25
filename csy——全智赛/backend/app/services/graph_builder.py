"""AttackGraph builder — generate AttackGraph from AgentManifest + optional topology.

Platform Line responsibility: manifest -> AttackGraph (nodes/edges with security
labels per docs/security-model.md section 3). Risk-path matching
(risk_path_ids) is performed by the Security Line RiskMatcher
(backend/attack_graph/risk_matcher.py) with patterns loaded by the Security KB
loader (backend/knowledge/kb_loader.py).

Stage 4: topology-aware graph construction.
  - single (default): identical to Stage 3 behavior
  - planner_executor: planner + executor AGENT nodes, R5 path
  - rag_agent: knowledge_base + retriever nodes, R6 path
"""

from __future__ import annotations

from backend.attack_graph.risk_matcher import fill_risk_path_ids
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.agent_topology import AgentTopology
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


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_tool_nodes_and_flags(
    capabilities: list[str],
) -> tuple[dict[str, GraphNode], dict[str, bool]]:
    """Create tool/memory/source nodes from manifest capabilities.

    Returns (nodes_dict, flags_dict) where flags track which tool categories
    are present (e.g. has_browser_source, has_email_send).
    """
    nodes: dict[str, GraphNode] = {}
    flags: dict[str, bool] = {
        "has_browser_source": False,
        "has_email_read": False,
        "has_email_list": False,
        "has_email_send": False,
        "has_memory_read": False,
        "has_memory_write": False,
    }

    for tool in capabilities:
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
            flags["has_browser_source"] = True
        elif tool == "email.read":
            flags["has_email_read"] = True
        elif tool == "email.list":
            flags["has_email_list"] = True
        elif tool == "email.send":
            flags["has_email_send"] = True
        elif tool == "memory.read":
            flags["has_memory_read"] = True
        elif tool == "memory.write":
            flags["has_memory_write"] = True

    return nodes, flags


def _add_data_source_nodes(
    nodes: dict[str, GraphNode],
    data_sources: list[str],
) -> None:
    """Add data source nodes (e.g. email -> SENSITIVE DATA)."""
    for source in data_sources:
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


def _add_edge(
    edges: list[Edge],
    nodes: dict[str, GraphNode],
    edge_id: str,
    src: str,
    dst: str,
    edge_type: str,
    desc: str,
    extra_metadata: dict | None = None,
) -> None:
    """Add an edge if both endpoints exist in nodes."""
    if src in nodes and dst in nodes:
        meta: dict = {"description": desc}
        if extra_metadata:
            meta.update(extra_metadata)
        edges.append(
            Edge(
                edge_id=edge_id,
                source_node_id=src,
                target_node_id=dst,
                edge_type=edge_type,
                metadata=meta,
            )
        )


def _finalize_graph(
    graph_id: str,
    agent_id: str,
    nodes: dict[str, GraphNode],
    edges: list[Edge],
) -> AttackGraph:
    """Build AttackGraph and run risk-path matching."""
    graph = AttackGraph(
        graph_id=graph_id,
        agent_id=agent_id,
        nodes=list(nodes.values()),
        edges=edges,
    )
    graph.risk_path_ids = fill_risk_path_ids(graph, load_risk_patterns(), max_depth=4)
    return graph


# ---------------------------------------------------------------------------
# Single agent (default — identical to Stage 3 behavior)
# ---------------------------------------------------------------------------

def _build_single_agent_graph(manifest: AgentManifest) -> AttackGraph:
    """Build attack graph for a single agent with multiple tools.

    This is the original Stage 3 logic, preserved exactly.
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

    tool_nodes, flags = _make_tool_nodes_and_flags(manifest.capabilities)
    nodes.update(tool_nodes)
    _add_data_source_nodes(nodes, manifest.data_sources)

    def _edge(edge_id: str, src: str, dst: str, edge_type: str, desc: str):
        _add_edge(edges, nodes, edge_id, src, dst, edge_type, desc)

    if flags["has_browser_source"]:
        _edge("e_browser_to_agent", "n_source_browser", agent_node_id, "READ_FROM",
              "Agent reads untrusted web content")
    if flags["has_email_list"]:
        _edge("e_agent_list_email", agent_node_id, "n_tool_email_list", "CALL",
              "Agent lists emails")
    if flags["has_email_read"]:
        _edge("e_agent_read_email", agent_node_id, "n_tool_email_read", "CALL",
              "Agent reads emails")
    if flags["has_email_send"]:
        _edge("e_agent_send_email", agent_node_id, "n_tool_email_send", "CALL",
              "Agent sends emails (CONFIRM required)")
    if flags["has_memory_write"]:
        _edge("e_agent_write_memory", agent_node_id, "n_memory_persistent", "WRITE_TO",
              "Agent writes to persistent memory")
    if flags["has_memory_read"]:
        _edge("e_agent_read_memory", "n_memory_persistent", agent_node_id, "READ_FROM",
              "Agent reads from persistent memory")
    if flags["has_email_read"] and "n_data_email" in nodes:
        _edge("e_email_read_to_agent", "n_data_email", "n_tool_email_read", "READ_FROM",
              "Email tool reads email data")
        _edge("e_email_read_data_to_agent", "n_tool_email_read", agent_node_id, "PASS_DATA",
              "Email content passed to agent — may contain malicious prompts or sensitive data")

    return _finalize_graph(
        f"graph-{manifest.agent_id}", manifest.agent_id, nodes, edges,
    )


# ---------------------------------------------------------------------------
# Planner-Executor topology (Stage 4)
# ---------------------------------------------------------------------------

def _build_planner_executor_graph(
    manifest: AgentManifest, topology: AgentTopology,
) -> AttackGraph:
    """Build attack graph for a planner-executor architecture.

    Structure:
        SOURCE (browser) → AGENT(planner) → AGENT(executor) → TOOL / MEMORY

    R5 (Plan Contamination) path: SOURCE → planner → executor → TOOL
    """
    planner_id = "n_agent_planner"
    executor_id = "n_agent_executor"
    nodes: dict[str, GraphNode] = {}
    edges: list[Edge] = []

    # Planner node — receives external input, decomposes tasks
    nodes[planner_id] = GraphNode(
        node_id=planner_id,
        node_type="AGENT",
        labels=["TRUSTED"],
        metadata={
            "name": "Task Planner",
            "role": "planner",
            "description": "Planner agent — decomposes tasks from external input",
        },
    )

    # Executor node — carries out planned tasks using tools
    nodes[executor_id] = GraphNode(
        node_id=executor_id,
        node_type="AGENT",
        labels=["TRUSTED"],
        metadata={
            "name": "Task Executor",
            "role": "executor",
            "description": "Executor agent — carries out planned tasks",
        },
    )

    # Tool/source/memory nodes from manifest capabilities
    tool_nodes, flags = _make_tool_nodes_and_flags(manifest.capabilities)
    nodes.update(tool_nodes)
    _add_data_source_nodes(nodes, manifest.data_sources)

    def _edge(edge_id: str, src: str, dst: str, edge_type: str, desc: str, **kw):
        _add_edge(edges, nodes, edge_id, src, dst, edge_type, desc, kw.get("extra_metadata"))

    # SOURCE → planner (untrusted content reaches planner)
    if flags["has_browser_source"]:
        _edge("e_browser_to_planner", "n_source_browser", planner_id, "READ_FROM",
              "Planner reads untrusted web content")

    # planner → executor (task plan, may carry untrusted content)
    _edge("e_planner_to_executor", planner_id, executor_id, "PASS_DATA",
          "Planner passes task plan to executor — may carry contaminated instructions",
          extra_metadata={"carries_untrusted_content": True, "channel": "task_plan"})

    # executor → tools
    if flags["has_email_list"]:
        _edge("e_executor_list_email", executor_id, "n_tool_email_list", "CALL",
              "Executor lists emails")
    if flags["has_email_read"]:
        _edge("e_executor_read_email", executor_id, "n_tool_email_read", "CALL",
              "Executor reads emails")
    if flags["has_email_send"]:
        _edge("e_executor_send_email", executor_id, "n_tool_email_send", "CALL",
              "Executor sends emails (CONFIRM required)")
    if flags["has_memory_write"]:
        _edge("e_executor_write_memory", executor_id, "n_memory_persistent", "WRITE_TO",
              "Executor writes to persistent memory")
    if flags["has_memory_read"]:
        _edge("e_executor_read_memory", "n_memory_persistent", executor_id, "READ_FROM",
              "Executor reads from persistent memory")
    if flags["has_email_read"] and "n_data_email" in nodes:
        _edge("e_email_read_to_executor", "n_data_email", "n_tool_email_read", "READ_FROM",
              "Email tool reads email data")
        _edge("e_email_read_data_to_executor", "n_tool_email_read", executor_id, "PASS_DATA",
              "Email content passed to executor")

    return _finalize_graph(
        f"graph-{manifest.agent_id}", manifest.agent_id, nodes, edges,
    )


# ---------------------------------------------------------------------------
# RAG-Agent topology (Stage 4)
# ---------------------------------------------------------------------------

def _build_rag_agent_graph(
    manifest: AgentManifest, topology: AgentTopology,
) -> AttackGraph:
    """Build attack graph for a RAG (retrieval-augmented generation) architecture.

    Structure:
        SOURCE (web docs) → KNOWLEDGE_BASE → AGENT(retriever) → AGENT(main) → TOOL

    R6 (RAG Context Poisoning) path: SOURCE → KB → retriever → agent → TOOL
    """
    retriever_id = "n_agent_retriever"
    kb_id = "n_knowledge_base"
    agent_id = f"n_agent_{manifest.agent_id}"
    nodes: dict[str, GraphNode] = {}
    edges: list[Edge] = []

    # External document source (web crawling / document ingestion)
    nodes["n_source_external_docs"] = GraphNode(
        node_id="n_source_external_docs",
        node_type="SOURCE",
        labels=["UNTRUSTED"],
        metadata={
            "name": "External Documents",
            "description": "External documents ingested into knowledge base — may contain hidden prompts",
        },
    )

    # Knowledge base node
    nodes[kb_id] = GraphNode(
        node_id=kb_id,
        node_type="KNOWLEDGE_BASE",
        labels=["UNTRUSTED"],
        metadata={
            "name": "Knowledge Base",
            "role": "knowledge_base",
            "description": "Vector store / knowledge base — indexes external documents, may be poisoned",
        },
    )

    # Retriever node
    nodes[retriever_id] = GraphNode(
        node_id=retriever_id,
        node_type="AGENT",
        labels=["TRUSTED"],
        metadata={
            "name": "Retrieval Agent",
            "role": "retriever",
            "description": "Retrieves relevant context from knowledge base",
        },
    )

    # Main agent node
    nodes[agent_id] = GraphNode(
        node_id=agent_id,
        node_type="AGENT",
        labels=["TRUSTED"],
        metadata={
            "name": manifest.name,
            "role": "agent",
            "description": f"{manifest.name} — main agent processing retrieved context",
        },
    )

    # Tool/source/memory nodes from manifest capabilities
    tool_nodes, flags = _make_tool_nodes_and_flags(manifest.capabilities)
    nodes.update(tool_nodes)
    _add_data_source_nodes(nodes, manifest.data_sources)

    def _edge(edge_id: str, src: str, dst: str, edge_type: str, desc: str, **kw):
        _add_edge(edges, nodes, edge_id, src, dst, edge_type, desc, kw.get("extra_metadata"))

    # SOURCE → KB (document ingestion)
    _edge("e_docs_to_kb", "n_source_external_docs", kb_id, "READ_FROM",
          "External documents ingested into knowledge base",
          extra_metadata={"carries_untrusted_content": True})

    # KB → retriever (retrieval)
    _edge("e_kb_to_retriever", kb_id, retriever_id, "READ_FROM",
          "Retriever fetches relevant context from KB — may retrieve poisoned content",
          extra_metadata={"carries_untrusted_content": True, "channel": "retrieval"})

    # retriever → main agent (pass retrieved context)
    _edge("e_retriever_to_agent", retriever_id, agent_id, "PASS_DATA",
          "Retrieved context passed to main agent — may contain injected prompts",
          extra_metadata={"carries_untrusted_content": True, "channel": "retrieval"})

    # Browser source → agent (if agent has browser capability)
    if flags["has_browser_source"]:
        _edge("e_browser_to_agent", "n_source_browser", agent_id, "READ_FROM",
              "Agent reads untrusted web content")

    # agent → tools
    if flags["has_email_list"]:
        _edge("e_agent_list_email", agent_id, "n_tool_email_list", "CALL",
              "Agent lists emails")
    if flags["has_email_read"]:
        _edge("e_agent_read_email", agent_id, "n_tool_email_read", "CALL",
              "Agent reads emails")
    if flags["has_email_send"]:
        _edge("e_agent_send_email", agent_id, "n_tool_email_send", "CALL",
              "Agent sends emails (CONFIRM required)")
    if flags["has_memory_write"]:
        _edge("e_agent_write_memory", agent_id, "n_memory_persistent", "WRITE_TO",
              "Agent writes to persistent memory")
    if flags["has_memory_read"]:
        _edge("e_agent_read_memory", "n_memory_persistent", agent_id, "READ_FROM",
              "Agent reads from persistent memory")
    if flags["has_email_read"] and "n_data_email" in nodes:
        _edge("e_email_read_to_agent", "n_data_email", "n_tool_email_read", "READ_FROM",
              "Email tool reads email data")
        _edge("e_email_read_data_to_agent", "n_tool_email_read", agent_id, "PASS_DATA",
              "Email content passed to agent")

    return _finalize_graph(
        f"graph-{manifest.agent_id}", manifest.agent_id, nodes, edges,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_attack_graph(
    manifest: AgentManifest,
    topology: AgentTopology | None = None,
) -> AttackGraph:
    """Build an AttackGraph from an AgentManifest and optional topology.

    When topology is None or 'single', behavior is identical to Stage 3.
    When topology is 'planner_executor', the graph includes planner + executor nodes.
    When topology is 'rag_agent', the graph includes knowledge_base + retriever nodes.
    """
    topo_type = topology.topology_type if topology else "single"

    if topo_type == "single":
        return _build_single_agent_graph(manifest)
    elif topo_type == "planner_executor":
        return _build_planner_executor_graph(manifest, topology)
    elif topo_type == "rag_agent":
        return _build_rag_agent_graph(manifest, topology)
    else:
        raise ValueError(f"Unsupported topology type: {topo_type!r}")
