"""Unit tests for Security KB loader (backend/knowledge/kb_loader.py).

S1-4: kb_loader loads shared/examples/security JSON into domain models so the
RiskMatcher consumes contract-validated RiskPattern objects.
"""
from backend.app.domain.risk_pattern import RiskPattern
from backend.knowledge.kb_loader import load_risk_patterns


def test_load_risk_patterns_returns_four_valid_patterns():
    patterns = load_risk_patterns()
    assert isinstance(patterns, list)
    assert all(isinstance(p, RiskPattern) for p in patterns)
    assert [p.id for p in patterns] == ["R1", "R2", "R3", "R4"]


def test_r4_is_the_only_critical_pattern():
    patterns = load_risk_patterns()
    critical = [p for p in patterns if p.severity == "CRITICAL"]
    assert [p.id for p in critical] == ["R4"]


def test_patterns_keep_contract_fields():
    patterns = {p.id: p for p in load_risk_patterns()}
    r4 = patterns["R4"]
    assert r4.risk_type == "persistent_indirect_prompt_injection"
    assert r4.node_pattern == ["SOURCE", "AGENT", "MEMORY", "AGENT", "TOOL"]
    assert r4.label_requirements["TOOL"] == ["DANGEROUS"]
    assert r4.judge_strategy == "rule"
    assert len(r4.judge_rules) > 0


def test_kb_file_missing_raises_file_not_found(tmp_path):
    import pytest
    with pytest.raises(FileNotFoundError):
        load_risk_patterns(path=tmp_path / "does-not-exist.json")