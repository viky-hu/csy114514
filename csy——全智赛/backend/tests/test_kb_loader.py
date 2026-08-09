"""Unit tests for Security KB Loader.

Covers:
  - Loading risk_patterns.json
  - Loading attack_seeds.json
  - Loading security_testcases.json
  - Cross-reference integrity (seed→pattern, testcase→seed)
  - Schema field completeness
"""

from pathlib import Path

import pytest

from backend.app.attack_graph._types import RiskPattern
from backend.app.knowledge.kb_loader import (
    load_all,
    load_attack_seeds,
    load_risk_patterns,
    load_security_testcases,
)

SECURITY_DIR = Path(__file__).resolve().parents[2] / "shared" / "examples" / "security"


class TestLoadRiskPatterns:
    def test_loads_4_patterns(self):
        patterns = load_risk_patterns(SECURITY_DIR)
        assert len(patterns) == 4

    def test_ids_are_r1_to_r4(self):
        patterns = load_risk_patterns(SECURITY_DIR)
        ids = {p.id for p in patterns}
        assert ids == {"R1", "R2", "R3", "R4"}

    def test_all_fields_populated(self):
        patterns = load_risk_patterns(SECURITY_DIR)
        for p in patterns:
            assert isinstance(p, RiskPattern)
            assert p.name
            assert p.description
            assert p.risk_type
            assert p.severity
            assert p.node_pattern
            assert p.attack_goal
            assert p.success_condition
            assert p.judge_strategy

    def test_r4_is_critical(self):
        patterns = load_risk_patterns(SECURITY_DIR)
        r4 = [p for p in patterns if p.id == "R4"][0]
        assert r4.severity == "CRITICAL"
        assert r4.risk_type == "persistent_indirect_prompt_injection"

    def test_node_pattern_length(self):
        patterns = load_risk_patterns(SECURITY_DIR)
        for p in patterns:
            assert 2 <= len(p.node_pattern) <= 5


class TestLoadAttackSeeds:
    def test_loads_8_seeds(self):
        seeds = load_attack_seeds(SECURITY_DIR)
        assert len(seeds) >= 8

    def test_unique_ids(self):
        seeds = load_attack_seeds(SECURITY_DIR)
        ids = [s["id"] for s in seeds]
        assert len(ids) == len(set(ids))

    def test_risk_pattern_refs_valid(self):
        """Each seed's risk_pattern_id must reference an existing pattern."""
        seeds = load_attack_seeds(SECURITY_DIR)
        patterns = load_risk_patterns(SECURITY_DIR)
        valid_ids = {p.id for p in patterns}
        for s in seeds:
            assert s["risk_pattern_id"] in valid_ids, f"{s['id']} refs invalid {s['risk_pattern_id']}"

    def test_risk_type_consistency(self):
        """Each seed's risk_type must match its referenced pattern's risk_type."""
        seeds = load_attack_seeds(SECURITY_DIR)
        patterns = load_risk_patterns(SECURITY_DIR)
        pattern_types = {p.id: p.risk_type for p in patterns}
        for s in seeds:
            expected = pattern_types[s["risk_pattern_id"]]
            assert s["risk_type"] == expected, (
                f"{s['id']}: seed risk_type={s['risk_type']} != pattern={expected}"
            )

    def test_payload_content_not_empty(self):
        seeds = load_attack_seeds(SECURITY_DIR)
        for s in seeds:
            assert s["payload"]["content"]
            assert s["payload"]["delivery_method"]

    def test_distribution(self):
        """Verify seed distribution: IPI×4, Memory×2, Privacy×2."""
        seeds = load_attack_seeds(SECURITY_DIR)
        by_pattern = {}
        for s in seeds:
            rid = s["risk_pattern_id"]
            by_pattern[rid] = by_pattern.get(rid, 0) + 1
        assert by_pattern.get("R1", 0) == 4  # IPI seeds → R1
        assert by_pattern.get("R2", 0) == 2  # Memory seeds → R2
        assert by_pattern.get("R3", 0) == 2  # Privacy seeds → R3


class TestLoadSecurityTestcases:
    def test_loads_6_cases(self):
        cases = load_security_testcases(SECURITY_DIR)
        assert len(cases) >= 6

    def test_unique_ids(self):
        cases = load_security_testcases(SECURITY_DIR)
        ids = [tc["id"] for tc in cases]
        assert len(ids) == len(set(ids))

    def test_distribution(self):
        """Verify: PI×2, IPI×2, Unauthorized×1, Privacy×1."""
        cases = load_security_testcases(SECURITY_DIR)
        by_risk = {}
        for tc in cases:
            rt = tc["risk_type"]
            by_risk[rt] = by_risk.get(rt, 0) + 1
        assert by_risk.get("unauthorized_tool_action", 0) == 3  # PI×2 + Unauth×1
        assert by_risk.get("indirect_prompt_injection", 0) == 2  # IPI×2
        assert by_risk.get("privacy_leakage", 0) == 1  # Privacy×1

    def test_attack_seed_refs_valid(self):
        """TestCase.attack_seed_ids must reference existing seeds."""
        cases = load_security_testcases(SECURITY_DIR)
        seeds = load_attack_seeds(SECURITY_DIR)
        valid_ids = {s["id"] for s in seeds}
        for tc in cases:
            for ref in tc.get("attack_seed_ids", []):
                assert ref in valid_ids, f"{tc['id']} refs invalid seed {ref}"

    def test_required_fields(self):
        cases = load_security_testcases(SECURITY_DIR)
        required = [
            "id", "name", "description", "risk_type", "severity",
            "scenario", "input", "expected_behavior", "forbidden_actions",
            "judge_policy", "success_criteria",
        ]
        for tc in cases:
            for field in required:
                assert field in tc, f"{tc['id']} missing field: {field}"

    def test_sr1_testcase_exists(self):
        """tc_unauth_001 must exist (required for SR1 vertical slice)."""
        cases = load_security_testcases(SECURITY_DIR)
        ids = [tc["id"] for tc in cases]
        assert "tc_unauth_001" in ids


class TestLoadAll:
    def test_load_all_keys(self):
        result = load_all(SECURITY_DIR)
        assert "risk_patterns" in result
        assert "attack_seeds" in result
        assert "testcases" in result

    def test_load_all_counts(self):
        result = load_all(SECURITY_DIR)
        assert len(result["risk_patterns"]) == 4
        assert len(result["attack_seeds"]) >= 8
        assert len(result["testcases"]) >= 6
