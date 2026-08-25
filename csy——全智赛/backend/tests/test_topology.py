"""Tests for Stage 4 AgentTopology: domain models, presets, graph_builder, path_finder, API.

Covers:
  - AgentTopology / TopologyNode / TopologyEdge model serialization
  - Topology presets (single / planner_executor / rag_agent)
  - graph_builder topology-aware graph construction
  - path_finder role_requirements matching
  - R5 + R6 risk patterns in risk_patterns.json
  - Topology API endpoints (GET/POST)
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.agent_topology import (
    AgentTopology,
    TopologyEdge,
    TopologyNode,
)
from backend.app.domain.topology_presets import (
    TOPOLOGY_PRESETS,
    get_topology_preset,
    list_presets,
)
from backend.app.domain.risk_pattern import RiskPattern
from backend.app.main import app
from backend.app.services.graph_builder import build_attack_graph
from backend.knowledge.kb_loader import load_risk_patterns

client = TestClient(app)


# ---------------------------------------------------------------------------
# Shared manifest (CorpMate with full capabilities)
# ---------------------------------------------------------------------------

_CORPMATE = AgentManifest(
    agent_id="corpmate-v0",
    name="CorpMate v0",
    version="0.1.0",
    capabilities=[
        "browser.open_page", "email.list", "email.read",
        "email.send", "memory.read", "memory.write",
    ],
    data_sources=["browser", "email"],
    memory={"type": "persistent"},
    tool_permissions={"browser.open_page": "ALLOW", "email.send": "CONFIRM"},
)


def _node(graph, node_id):
    return next(n for n in graph.nodes if n.node_id == node_id)


def _edge(graph, edge_id):
    return next(e for e in graph.edges if e.edge_id == edge_id)


def _node_ids(graph):
    return {n.node_id for n in graph.nodes}


def _edge_ids(graph):
    return {e.edge_id for e in graph.edges}


# ===========================================================================
# 1. Domain model tests
# ===========================================================================

class TestAgentTopologyModel:
    """AgentTopology Pydantic model validation."""

    def test_round_trip_serialization(self):
        topo = AgentTopology(
            agent_id="test-agent",
            topology_type="planner_executor",
            nodes=[
                TopologyNode(id="planner", role="PLANNER"),
                TopologyNode(id="executor", role="EXECUTOR", tools=["email.send"]),
            ],
            edges=[
                TopologyEdge(from_node="planner", to_node="executor", channel="task_plan"),
            ],
        )
        json_str = topo.model_dump_json()
        restored = AgentTopology.model_validate_json(json_str)
        assert restored.agent_id == "test-agent"
        assert restored.topology_type == "planner_executor"
        assert len(restored.nodes) == 2
        assert len(restored.edges) == 1

    def test_defaults(self):
        topo = AgentTopology(agent_id="a", topology_type="single")
        assert topo.nodes == []
        assert topo.edges == []

    def test_topology_node_defaults(self):
        node = TopologyNode(id="agent", role="AGENT")
        assert node.trust_boundary == "internal"
        assert node.tools == []

    def test_topology_edge_defaults(self):
        edge = TopologyEdge(from_node="a", to_node="b")
        assert edge.channel == "default"
        assert edge.carries_untrusted_content is False


# ===========================================================================
# 2. Preset tests
# ===========================================================================

class TestTopologyPresets:
    """Topology preset definitions."""

    def test_three_presets_exist(self):
        assert set(TOPOLOGY_PRESETS.keys()) == {"single", "planner_executor", "rag_agent"}

    def test_get_preset_fills_agent_id(self):
        topo = get_topology_preset("planner_executor", "my-agent")
        assert topo.agent_id == "my-agent"
        assert topo.topology_type == "planner_executor"

    def test_get_preset_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown topology preset"):
            get_topology_preset("supervisor_worker", "x")

    def test_list_presets(self):
        result = list_presets()
        assert len(result) == 3
        types = {p["topology_type"] for p in result}
        assert types == {"single", "planner_executor", "rag_agent"}

    def test_single_preset_has_one_node(self):
        topo = TOPOLOGY_PRESETS["single"]
        assert len(topo.nodes) == 1
        assert topo.nodes[0].role == "AGENT"

    def test_planner_executor_preset_structure(self):
        topo = TOPOLOGY_PRESETS["planner_executor"]
        roles = {n.role for n in topo.nodes}
        assert roles == {"PLANNER", "EXECUTOR"}
        assert len(topo.edges) == 1
        assert topo.edges[0].carries_untrusted_content is True

    def test_rag_agent_preset_structure(self):
        topo = TOPOLOGY_PRESETS["rag_agent"]
        roles = {n.role for n in topo.nodes}
        assert "RETRIEVER" in roles
        assert "KNOWLEDGE_BASE" in roles
        assert "AGENT" in roles
        assert len(topo.edges) == 2


# ===========================================================================
# 3. Graph builder topology tests
# ===========================================================================

class TestGraphBuilderTopology:
    """graph_builder with topology parameter."""

    def test_single_topology_same_as_no_topology(self):
        """topology=None and topology=single produce identical graphs."""
        g_none = build_attack_graph(_CORPMATE)
        g_single = build_attack_graph(_CORPMATE, topology=get_topology_preset("single", "corpmate-v0"))
        assert _node_ids(g_none) == _node_ids(g_single)
        assert _edge_ids(g_none) == _edge_ids(g_single)
        assert g_none.risk_path_ids == g_single.risk_path_ids

    def test_planner_executor_has_planner_and_executor_nodes(self):
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        planner = _node(graph, "n_agent_planner")
        assert planner.node_type == "AGENT"
        assert planner.metadata["role"] == "planner"

        executor = _node(graph, "n_agent_executor")
        assert executor.node_type == "AGENT"
        assert executor.metadata["role"] == "executor"

    def test_planner_executor_has_planner_to_executor_edge(self):
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        e = _edge(graph, "e_planner_to_executor")
        assert e.source_node_id == "n_agent_planner"
        assert e.target_node_id == "n_agent_executor"
        assert e.edge_type == "PASS_DATA"

    def test_planner_executor_browser_goes_to_planner(self):
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        e = _edge(graph, "e_browser_to_planner")
        assert e.source_node_id == "n_source_browser"
        assert e.target_node_id == "n_agent_planner"

    def test_planner_executor_tools_connected_to_executor(self):
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        e = _edge(graph, "e_executor_send_email")
        assert e.source_node_id == "n_agent_executor"
        assert e.target_node_id == "n_tool_email_send"

    def test_planner_executor_r5_matched(self):
        """R5 (plan contamination) should be matched in planner_executor topology."""
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)
        assert "R5" in graph.risk_path_ids

    def test_planner_executor_still_matches_r1(self):
        """R1 should still match (subsequence compatibility)."""
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)
        assert "R1" in graph.risk_path_ids

    def test_rag_agent_has_knowledge_base_node(self):
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        kb = _node(graph, "n_knowledge_base")
        assert kb.node_type == "KNOWLEDGE_BASE"
        assert kb.metadata["role"] == "knowledge_base"
        assert "UNTRUSTED" in kb.labels

    def test_rag_agent_has_retriever_node(self):
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        ret = _node(graph, "n_agent_retriever")
        assert ret.node_type == "AGENT"
        assert ret.metadata["role"] == "retriever"

    def test_rag_agent_has_external_docs_source(self):
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        src = _node(graph, "n_source_external_docs")
        assert src.node_type == "SOURCE"
        assert "UNTRUSTED" in src.labels

    def test_rag_agent_data_flow_chain(self):
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        # SOURCE → KB → retriever → agent
        _edge(graph, "e_docs_to_kb")
        _edge(graph, "e_kb_to_retriever")
        _edge(graph, "e_retriever_to_agent")

    def test_rag_agent_r6_matched(self):
        """R6 (RAG context poisoning) should be matched in rag_agent topology."""
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)
        assert "R6" in graph.risk_path_ids

    def test_rag_agent_tools_connected_to_main_agent(self):
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)

        e = _edge(graph, "e_agent_send_email")
        assert e.target_node_id == "n_tool_email_send"

    def test_edges_only_reference_existing_nodes_planner(self):
        topo = get_topology_preset("planner_executor", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)
        node_ids = _node_ids(graph)
        for e in graph.edges:
            assert e.source_node_id in node_ids
            assert e.target_node_id in node_ids

    def test_edges_only_reference_existing_nodes_rag(self):
        topo = get_topology_preset("rag_agent", "corpmate-v0")
        graph = build_attack_graph(_CORPMATE, topology=topo)
        node_ids = _node_ids(graph)
        for e in graph.edges:
            assert e.source_node_id in node_ids
            assert e.target_node_id in node_ids

    def test_unsupported_topology_raises(self):
        bad_topo = AgentTopology(agent_id="x", topology_type="supervisor_worker")
        with pytest.raises(ValueError, match="Unsupported topology"):
            build_attack_graph(_CORPMATE, topology=bad_topo)


# ===========================================================================
# 4. Path finder role matching tests
# ===========================================================================

class TestPathFinderRoles:
    """path_finder role_requirements support."""

    def test_r5_requires_planner_and_executor_roles(self):
        """R5 only matches when AGENT nodes have correct roles."""
        patterns = load_risk_patterns()
        r5 = next(p for p in patterns if p.id == "R5")
        assert r5.role_requirements == {"1": "planner", "2": "executor"}

    def test_r6_no_role_requirements(self):
        """R6 uses node types only (KNOWLEDGE_BASE is distinct enough)."""
        patterns = load_risk_patterns()
        r6 = next(p for p in patterns if p.id == "R6")
        assert r6.role_requirements == {}

    def test_r1_has_no_role_requirements(self):
        """Existing R1 is unaffected."""
        patterns = load_risk_patterns()
        r1 = next(p for p in patterns if p.id == "R1")
        assert r1.role_requirements == {}


# ===========================================================================
# 5. Risk pattern tests
# ===========================================================================

class TestRiskPatternsR5R6:
    """R5 and R6 risk patterns can be loaded from JSON."""

    def test_r5_loads_correctly(self):
        patterns = load_risk_patterns()
        r5 = next(p for p in patterns if p.id == "R5")
        assert r5.risk_type == "plan_contamination"
        assert r5.severity == "HIGH"
        assert r5.node_pattern == ["SOURCE", "AGENT", "AGENT", "TOOL"]

    def test_r6_loads_correctly(self):
        patterns = load_risk_patterns()
        r6 = next(p for p in patterns if p.id == "R6")
        assert r6.risk_type == "rag_context_poisoning"
        assert r6.severity == "HIGH"
        assert r6.node_pattern == ["SOURCE", "KNOWLEDGE_BASE", "AGENT", "TOOL"]

    def test_six_patterns_total(self):
        patterns = load_risk_patterns()
        ids = {p.id for p in patterns}
        assert ids == {"R1", "R2", "R3", "R4", "R5", "R6"}


# ===========================================================================
# 6. Topology API tests
# ===========================================================================

class TestTopologyAPI:
    """Topology API endpoints."""

    def test_list_presets_endpoint(self):
        resp = client.get("/topology/presets")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        types = {p["topology_type"] for p in data}
        assert "planner_executor" in types

    def test_get_default_topology(self):
        resp = client.get("/topology/some-agent-id")
        assert resp.status_code == 200
        data = resp.json()
        assert data["topology_type"] == "single"
        assert data["agent_id"] == "some-agent-id"

    def test_set_topology_planner_executor(self):
        resp = client.post(
            "/topology/test-agent-top",
            json={"preset_name": "planner_executor"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["topology_type"] == "planner_executor"
        assert data["agent_id"] == "test-agent-top"

        # GET should return the stored topology
        resp2 = client.get("/topology/test-agent-top")
        assert resp2.status_code == 200
        assert resp2.json()["topology_type"] == "planner_executor"

    def test_set_topology_unknown_preset(self):
        resp = client.post(
            "/topology/test-agent-unknown",
            json={"preset_name": "supervisor_worker"},
        )
        assert resp.status_code == 422
        assert "Unknown topology preset" in resp.json()["detail"]

    def test_set_topology_invalid_body(self):
        resp = client.post(
            "/topology/test-agent-bad",
            json={"wrong_field": "single"},
        )
        assert resp.status_code == 422


# ===========================================================================
# 7. OpenAPI schema tests
# ===========================================================================

class TestTopologyOpenAPI:
    """Topology endpoints appear in OpenAPI schema."""

    def test_endpoints_in_schema(self):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json()["paths"]
        assert "/topology/presets" in paths
        assert "/topology/{agent_id}" in paths
