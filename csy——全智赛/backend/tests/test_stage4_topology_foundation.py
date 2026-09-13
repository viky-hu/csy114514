"""Stage 4 topology persistence, fixture, sandbox, and evaluation contract tests."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from backend.app.domain.agent_topology import AgentTopology, TopologyEdge, TopologyNode
from backend.app.domain.test_case import TestCase
from backend.app.domain.test_scenario import EnvDelta, InitialState
from backend.app.domain.topology_presets import get_topology_preset
from backend.app.knowledge.kb_loader import load_all_test_case_files
from backend.app.sandbox.composite import CompositeSandbox
from backend.app.services import evaluation_service, topology_service


SHARED_ROOT = Path(__file__).resolve().parents[2] / "shared"
SECURITY_DIR = SHARED_ROOT / "examples" / "security"


def test_topology_service_survives_configured_store_restart(tmp_path: Path) -> None:
    """Replacing SQLite with process memory would lose the selected topology."""
    database_path = tmp_path / "topology.sqlite3"
    topology_service.configure(database_path=database_path)
    topology_service.set_topology(
        get_topology_preset("planner_executor", "persistent-agent")
    )
    topology_service.shutdown()

    topology_service.configure(database_path=database_path)
    restored = topology_service.get_topology("persistent-agent")

    assert restored is not None
    assert restored.topology_type == "planner_executor"
    assert restored.agent_id == "persistent-agent"
    topology_service.shutdown()


def test_topology_contract_rejects_edges_to_unknown_nodes() -> None:
    """Removing graph-integrity validation would allow unusable topology records."""
    with pytest.raises(ValueError, match="unknown node"):
        AgentTopology(
            agent_id="agent-1",
            topology_type="planner_executor",
            nodes=[TopologyNode(id="planner", role="PLANNER")],
            edges=[TopologyEdge(from_node="planner", to_node="executor")],
        )


def test_r5_r6_testcase_files_are_discoverable_and_contract_valid() -> None:
    """Misnamed or legacy-shaped fixtures would silently disappear from evaluation."""
    filenames = {
        "security_testcases_r5.json",
        "security_testcases_r6.json",
    }
    assert filenames <= {path.name for path in SECURITY_DIR.glob("*.json")}

    schema = json.loads(
        (SHARED_ROOT / "contracts" / "test_case.schema.json").read_text(encoding="utf-8")
    )
    validator = Draft202012Validator(schema)
    loaded_by_id = {case["id"]: case for case in load_all_test_case_files(SECURITY_DIR)}
    for filename in filenames:
        raw_cases = json.loads((SECURITY_DIR / filename).read_text(encoding="utf-8"))
        for raw_case in raw_cases:
            assert not list(validator.iter_errors(raw_case))
            assert TestCase.model_validate(raw_case).id in loaded_by_id


def test_knowledge_base_documents_are_incremental_sandbox_state() -> None:
    """Dropping delta merge support would make R6's poisoned document unreachable."""
    initial = InitialState(
        knowledge_base_docs={"policy": "trusted policy"},
    )
    delta = EnvDelta(
        knowledge_base_docs={"advisory": "hidden instruction from external document"},
    )
    sandbox = CompositeSandbox()

    sandbox.reset(initial.model_dump())
    sandbox.apply_delta(delta)

    assert sandbox.snapshot()["knowledge_base"]["documents"] == {
        "policy": "trusted policy",
        "advisory": "hidden instruction from external document",
    }


@pytest.mark.parametrize(
    ("preset_name", "test_case_id", "risk_pattern", "expected_roles", "expected_channel"),
    [
        (
            "planner_executor",
            "tc_r5_plan_001",
            "R5",
            {"PLANNER", "EXECUTOR"},
            "task_plan",
        ),
        (
            "rag_agent",
            "tc_r6_rag_001",
            "R6",
            {"KNOWLEDGE_BASE", "RETRIEVER", "AGENT"},
            "retrieval",
        ),
    ],
)
def test_controlled_topology_fixtures_emit_traceable_findings(
    tmp_path: Path,
    preset_name: str,
    test_case_id: str,
    risk_pattern: str,
    expected_roles: set[str],
    expected_channel: str,
) -> None:
    """Falling back to CorpMate would erase R5/R6 role and channel causality."""
    topology_service.shutdown()
    evaluation_service.shutdown()
    topology_service.configure(database_path=tmp_path / "topology.sqlite3")
    topology_service.set_topology(get_topology_preset(preset_name, "corpmate-v0"))
    coordinator = evaluation_service.configure(
        database_path=tmp_path / "evaluations.sqlite3",
        fingerprint_key="stage4-test-fingerprint-key",
        start_worker=False,
    )

    run, created = coordinator.create(
        request_id=f"stage4-{risk_pattern.lower()}",
        agent_id="corpmate-v0",
        test_case_ids=[test_case_id],
    )
    assert created is True
    coordinator.start(run.run_id)
    assert coordinator.process_queued_once() is True

    trace = coordinator.get_trace(run.run_id)
    role_events = [event for event in trace.events if event.type == "TOPOLOGY_ROLE_INVOKED"]
    channel_events = [
        event for event in trace.events if event.type == "TOPOLOGY_CHANNEL_TRANSFER"
    ]
    report = coordinator.get_report(run.run_id)

    assert {event.payload["role"] for event in role_events} == expected_roles
    assert expected_channel in {event.payload["channel"] for event in channel_events}
    assert report.summary.by_risk_pattern[risk_pattern]["failed"] == 1
    assert len(report.findings) == 1
    assert report.findings[0].risk_pattern_id == risk_pattern
    persisted_ids = {event.event_id for event in trace.events}
    assert report.findings[0].evidence
    assert {
        evidence.event_id for evidence in report.findings[0].evidence
    } <= persisted_ids

    evaluation_service.shutdown()
    topology_service.shutdown()
