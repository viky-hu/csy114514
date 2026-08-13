"""L4 domain tests: EnvDelta + ScenarioTurn.env_delta + TestCase input Optional."""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.app.domain.test_case import TestCase
from backend.app.domain.test_scenario import EnvDelta, ScenarioTurn

SECURITY_EXAMPLES = Path(__file__).parent.parent.parent / "shared" / "examples" / "security"


def _base_case(**overrides):
    data = {
        "id": "tc_x_001", "name": "x", "description": "x",
        "risk_type": "privacy_leakage", "severity": "LOW",
        "scenario": {
            "summary": "x",
            "initial_state": {"email_inbox": [], "memory": [], "browser_pages": {}},
            "target_agent": "corpmate",
        },
        "input": "x",
        "expected_behavior": "x",
        "forbidden_actions": ["email.send"],
        "judge_policy": "rule",
        "success_criteria": {"pass_if": ["a"], "fail_if": ["b"]},
    }
    data.update(overrides)
    return data


class TestEnvDeltaModel:
    def test_parses_r4_browser_pages(self):
        raw = {"browser_pages": {"https://evil.example/preference-hijack": "<html><body><p>hidden</p></body></html>"}}
        delta = EnvDelta.model_validate(raw)
        assert delta.browser_pages["https://evil.example/preference-hijack"].startswith("<html>")
        assert delta.memory is None
        assert delta.email_inbox is None

    def test_parses_memory_and_email(self):
        delta = EnvDelta.model_validate({"memory": ["k=v"], "email_inbox": ["email_001"]})
        assert delta.memory == ["k=v"]
        assert delta.email_inbox == ["email_001"]

    def test_empty_delta_defaults_none(self):
        delta = EnvDelta()
        assert delta.browser_pages is None and delta.memory is None and delta.email_inbox is None

    def test_scenario_turn_parses_env_delta(self):
        turn = ScenarioTurn.model_validate({
            "turn_id": "turn_1", "input": "open it", "starts_new_session": True,
            "env_delta": {"browser_pages": {"https://a.example": "html"}},
        })
        assert turn.env_delta is not None
        assert "https://a.example" in turn.env_delta.browser_pages


class TestTestCaseL4:
    def test_input_optional_when_turns_present(self):
        data = _base_case(input=None)
        data["scenario"]["turns"] = [{"turn_id": "turn_1", "input": "hi", "starts_new_session": True}]
        tc = TestCase.model_validate(data)
        assert tc.input is None
        assert len(tc.scenario.turns) == 1

    def test_input_only_still_valid(self):
        tc = TestCase.model_validate(_base_case())
        assert tc.input == "x"
        assert tc.scenario.turns == []

    def test_neither_input_nor_turns_rejected(self):
        with pytest.raises(ValidationError):
            TestCase.model_validate(_base_case(input=None))

    def test_not_collected_by_pytest(self):
        assert TestCase.__test__ is False

    def test_r4_fixture_loads_with_env_delta(self):
        raw_cases = json.loads((SECURITY_EXAMPLES / "security_testcases_r4.json").read_text(encoding="utf-8"))
        tc = TestCase.model_validate(next(c for c in raw_cases if c["id"] == "tc_r4_e2e_001"))
        assert tc.scenario.turns[0].env_delta is not None
        assert "https://evil.example/preference-hijack" in tc.scenario.turns[0].env_delta.browser_pages
class TestCatalogLoadsAllFiles:
    def test_all_catalog_files_validate_through_pydantic(self):
        from backend.app.knowledge.kb_loader import load_all_test_case_files
        raw_cases = load_all_test_case_files()
        assert len(raw_cases) >= 47
        for raw in raw_cases:
            TestCase.model_validate(raw)
