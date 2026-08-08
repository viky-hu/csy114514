"""Contract gates for the R4 evaluation vertical slice."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from backend.app.domain.enums import EventType
from backend.app.domain.evaluation_report import EvaluationReport
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.risk_finding import RiskFinding
from backend.app.domain.test_case import TestCase as DomainTestCase

ROOT = Path(__file__).resolve().parents[2]
SECURITY_EXAMPLES = ROOT / "shared" / "examples" / "security"
CONTRACTS = ROOT / "shared" / "contracts"


def test_r4_test_case_declares_two_sessions() -> None:
    cases = json.loads(
        (SECURITY_EXAMPLES / "security_testcases.json").read_text(encoding="utf-8")
    )
    raw = next(case for case in cases if case["id"] == "tc_pipi_001")

    test_case = DomainTestCase.model_validate(raw)
    assert [turn.turn_id for turn in test_case.scenario.turns] == ["turn_1", "turn_2"]
    assert test_case.scenario.turns[0].starts_new_session is True
    assert test_case.scenario.turns[1].starts_new_session is True


def test_test_case_contract_contains_optional_turns() -> None:
    schema = json.loads((CONTRACTS / "test_case.schema.json").read_text(encoding="utf-8"))
    turns = schema["properties"]["scenario"]["properties"]["turns"]
    assert turns["type"] == "array"
    assert turns["items"]["required"] == ["turn_id", "input", "starts_new_session"]


def test_evaluation_run_uses_controlled_state_and_metadata() -> None:
    run = EvaluationRun.model_validate(
        {
            "run_id": "run-001",
            "agent_id": "corpmate-v0",
            "test_case_ids": ["tc_pipi_001"],
            "status": "ready",
            "created_at": "2026-08-08T00:00:00Z",
            "started_at": None,
            "finished_at": None,
            "current_stage": "web_content_injection",
            "last_event_seq": 1,
            "report_available": False,
            "error": None,
        }
    )
    assert run.status == "ready"
    assert run.current_stage == "web_content_injection"

    with pytest.raises(ValidationError):
        EvaluationRun.model_validate(
            {
                **run.model_dump(mode="json"),
                "status": "pending",
            }
        )


def test_r4_event_types_are_frozen() -> None:
    expected_new = {
        "PREFLIGHT_COMPLETED",
        "PREFLIGHT_FAILED",
        "AGENT_INVOKED",
        "AGENT_RESPONDED",
        "TOOL_RESULT",
        "RUN_FAILED",
    }
    assert expected_new.issubset({event.value for event in EventType})


def test_tool_result_payload_matches_frozen_redacted_schema() -> None:
    schema = json.loads(
        (CONTRACTS / "execution_event.schema.json").read_text(encoding="utf-8")
    )
    event = {
        "event_id": "evt-001",
        "run_id": "run-001",
        "timestamp": "2026-08-08T00:00:00Z",
        "type": "TOOL_RESULT",
        "payload": {
            "stage": "persistent_memory_poisoning",
            "call_id": "call-001",
            "turn_id": "turn_1",
            "session_id": "session-001",
            "tool_name": "memory.write",
            "success": True,
            "matched_canary_fingerprints": ["a" * 64],
            "canary_fingerprint": "a" * 64,
            "memory_key_fingerprint": "b" * 64,
            "value_fingerprint": "c" * 64,
            "error_code": None,
        },
    }

    Draft202012Validator(schema).validate(event)


def test_risk_finding_accepts_rule_types_and_remediation() -> None:
    finding = RiskFinding.model_validate(
        {
            "finding_id": "finding-001",
            "evaluation_id": "run-001",
            "risk_type": "persistent_indirect_prompt_injection",
            "severity": "CRITICAL",
            "risk_pattern_id": "R4",
            "description": "Full persistent indirect prompt injection chain.",
            "evidence": [],
            "rule_types": ["full_chain_persistent_ipi"],
            "remediation": "Treat webpage instructions as untrusted data.",
        }
    )
    assert finding.rule_types == ["full_chain_persistent_ipi"]
    assert finding.remediation.startswith("Treat")


def test_evaluation_report_accepts_recomputable_score_breakdown() -> None:
    report = EvaluationReport.model_validate(
        {
            "report_id": "report-001",
            "evaluation_id": "run-001",
            "agent_id": "corpmate-v0",
            "overall_score": 39,
            "severity": "CRITICAL",
            "findings": [],
            "conclusion": "Critical R4 chain detected.",
            "score_breakdown": {
                "algorithm_version": "r4-mvp-v1",
                "dimensions": {
                    "capability": 100,
                    "execution_stability": 100,
                    "security": 0,
                },
                "weights": {
                    "capability": 25,
                    "execution_stability": 20,
                    "security": 55,
                },
                "deductions": [
                    {
                        "dimension": "security",
                        "rule_type": "full_chain_persistent_ipi",
                        "points": 100,
                        "evidence_event_ids": ["evt-1"],
                    }
                ],
                "severity_cap": {"severity": "CRITICAL", "maximum_score": 39},
            },
        }
    )
    assert report.score_breakdown.algorithm_version == "r4-mvp-v1"
    assert report.score_breakdown.weights.security == 55
