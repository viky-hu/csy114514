"""Fixture gate — every fixture must validate against its Pydantic model.

CODING_AGENT_RULE 7: fixtures must pass contract validation.
"""
import json
from pathlib import Path

from backend.app.domain.agent_profile import AgentProfile
from backend.app.domain.attack_graph import AttackGraph
from backend.app.domain.evaluation_report import EvaluationReport

FIXTURES_DIR = Path(__file__).parent.parent.parent / "shared" / "fixtures"


def _load_json(filename: str) -> dict:
    path = FIXTURES_DIR / filename
    assert path.exists(), f"Fixture not found: {path}"
    return json.loads(path.read_text(encoding="utf-8"))


class TestFixtureValidation:
    def test_agent_profile_fixture_is_valid(self):
        data = _load_json("agent_profile.json")
        obj = AgentProfile.model_validate(data)
        assert obj.agent_id == "corpmate-v0"
        assert len(obj.manifest.capabilities) == 7

    def test_attack_graph_fixture_is_valid(self):
        data = _load_json("attack_graph.json")
        obj = AttackGraph.model_validate(data)
        assert len(obj.nodes) == 7
        assert len(obj.edges) == 7
        assert "R4" in obj.risk_path_ids

    def test_attack_graph_all_nodes_have_valid_types(self):
        data = _load_json("attack_graph.json")
        obj = AttackGraph.model_validate(data)
        valid_types = {"SOURCE", "AGENT", "TOOL", "MEMORY", "DATA"}
        for node in obj.nodes:
            assert node.node_type in valid_types, f"Invalid node_type: {node.node_type}"

    def test_attack_graph_all_edges_have_valid_types(self):
        data = _load_json("attack_graph.json")
        obj = AttackGraph.model_validate(data)
        valid_types = {"READ_FROM", "WRITE_TO", "CALL", "PASS_DATA", "CONTROL"}
        for edge in obj.edges:
            assert edge.edge_type in valid_types, f"Invalid edge_type: {edge.edge_type}"

    def test_evaluation_report_fixture_is_valid(self):
        data = _load_json("evaluation_report.json")
        obj = EvaluationReport.model_validate(data)
        assert len(obj.findings) == 2
        assert obj.findings[0].severity == "CRITICAL"

    def test_fixtures_dir_contains_required_files(self):
        required = {"agent_profile.json", "attack_graph.json", "evaluation_report.json"}
        actual = {f.name for f in FIXTURES_DIR.iterdir() if f.suffix == ".json"}
        assert required.issubset(actual), f"Missing fixtures: {required - actual}"
