"""Test global frozen enums — values must match CODING_AGENT_RULE §2.1."""
import pytest

from backend.app.domain.enums import (
    EdgeType,
    EventType,
    JudgeStrategy,
    NodeLabel,
    NodeType,
    Permission,
    RiskType,
    Severity,
)


class TestRiskType:
    def test_all_values_present(self):
        expected = {
            "indirect_prompt_injection",
            "unauthorized_tool_action",
            "memory_poisoning",
            "privacy_leakage",
            "data_exfiltration",
            "persistent_indirect_prompt_injection",
        }
        assert {e.value for e in RiskType} == expected

    def test_rejects_invalid(self):
        with pytest.raises(ValueError):
            RiskType("nonexistent_type")


class TestSeverity:
    def test_all_values_present(self):
        expected = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        assert {e.value for e in Severity} == expected

    def test_rejects_invalid(self):
        with pytest.raises(ValueError):
            Severity("nonexistent")


class TestPermission:
    def test_all_values_present(self):
        expected = {"ALLOW", "CONFIRM", "DENY"}
        assert {e.value for e in Permission} == expected


class TestNodeType:
    def test_all_values_present(self):
        expected = {"SOURCE", "AGENT", "TOOL", "MEMORY", "DATA"}
        assert {e.value for e in NodeType} == expected


class TestNodeLabel:
    def test_all_values_present(self):
        expected = {"UNTRUSTED", "TRUSTED", "SENSITIVE", "DANGEROUS", "PERSISTENT"}
        assert {e.value for e in NodeLabel} == expected


class TestEdgeType:
    def test_all_values_present(self):
        expected = {"READ_FROM", "WRITE_TO", "CALL", "PASS_DATA", "CONTROL"}
        assert {e.value for e in EdgeType} == expected


class TestEventType:
    def test_all_values_present(self):
        expected = {
            "RUN_STARTED", "ANATOMY_READY", "RISK_PATH_FOUND",
            "TEST_STARTED", "SEED_SELECTED", "MUTATION_CREATED",
            "TOOL_CALLED", "MEMORY_WRITTEN", "JUDGE_DECISION",
            "FINDING_CREATED", "RUN_FINISHED", "PREFLIGHT_COMPLETED",
            "PREFLIGHT_FAILED", "AGENT_INVOKED", "AGENT_RESPONDED",
            "TOOL_RESULT", "RUN_FAILED", "TEST_COMPLETED",
        }
        assert {e.value for e in EventType} == expected


class TestJudgeStrategy:
    def test_all_values_present(self):
        expected = {"rule", "llm", "composite"}
        assert {e.value for e in JudgeStrategy} == expected
