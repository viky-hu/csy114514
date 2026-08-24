"""Tests for Red Team API: domain model, JSON report generation, HTTP endpoints.

Covers:
  - RedTeamReport Pydantic model serialization round-trip
  - generate_json_report() with synthetic data
  - GET /redteam/report (404 + success)
  - POST /redteam/start parameter validation
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app.domain.redteam_report import (
    BypassDetail,
    DefenseEffectiveness,
    RedTeamReport,
    RoundEvolution,
    SeedUsed,
    StrategyEffectiveness,
)
from backend.app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_sample_report() -> RedTeamReport:
    """Create a sample RedTeamReport for testing."""
    return RedTeamReport(
        target_agent="defended-llm-v0",
        rounds=2,
        seeds_count=4,
        variants_generated=16,
        bypasses_found=0,
        bypass_rate=0.0,
        total_time_s=124.9,
        round_evolution=[
            RoundEvolution(
                round=1,
                variants=8,
                passed=8,
                failed=0,
                bypasses=0,
                active_strategies=["encoding", "synonym", "cross_session"],
            ),
            RoundEvolution(
                round=2,
                variants=8,
                passed=8,
                failed=0,
                bypasses=0,
                active_strategies=["mixed_lang", "social", "encoding"],
            ),
        ],
        defense_effectiveness=[
            DefenseEffectiveness(defense_id="D1", defense_name="InputFilter", blocks=16),
            DefenseEffectiveness(defense_id="D5", defense_name="ChainDetector", blocks=3),
        ],
        strategy_effectiveness=[
            StrategyEffectiveness(
                strategy="encoding", variants=7, bypasses=0,
                success_rate=0.0, weight_final=0.91,
            ),
            StrategyEffectiveness(
                strategy="synonym", variants=2, bypasses=0,
                success_rate=0.0, weight_final=0.70,
            ),
        ],
        weight_history={
            "encoding": [1.0, 0.91],
            "synonym": [1.0, 0.70],
        },
        bypasses=[],
        seeds_used=[
            SeedUsed(id="tc_def_safe_browse_002", risk_pattern="R1", severity="CRITICAL"),
            SeedUsed(id="tc_hard_social_002", risk_pattern="R2", severity="HIGH"),
        ],
    )


# ---------------------------------------------------------------------------
# Domain model tests
# ---------------------------------------------------------------------------

class TestRedTeamReportModel:
    """RedTeamReport Pydantic model validation."""

    def test_round_trip_serialization(self):
        """Model can be serialized to JSON and deserialized back."""
        report = _make_sample_report()
        json_str = report.model_dump_json()
        restored = RedTeamReport.model_validate_json(json_str)

        assert restored.target_agent == report.target_agent
        assert restored.rounds == report.rounds
        assert restored.variants_generated == report.variants_generated
        assert restored.bypass_rate == report.bypass_rate
        assert len(restored.round_evolution) == 2
        assert len(restored.defense_effectiveness) == 2
        assert len(restored.strategy_effectiveness) == 2
        assert restored.weight_history == report.weight_history

    def test_field_constraints(self):
        """Field constraints are enforced."""
        # bypass_rate must be 0.0 ~ 1.0
        with pytest.raises(Exception):
            RedTeamReport(
                target_agent="test",
                bypass_rate=1.5,
                score_breakdown={},
            )

        # rounds must be >= 0
        with pytest.raises(Exception):
            RedTeamReport(
                target_agent="test",
                rounds=-1,
            )

    def test_default_values(self):
        """Minimal report uses sensible defaults."""
        report = RedTeamReport(target_agent="test-agent")
        assert report.rounds == 0
        assert report.variants_generated == 0
        assert report.bypasses_found == 0
        assert report.bypass_rate == 0.0
        assert report.round_evolution == []
        assert report.defense_effectiveness == []
        assert report.strategy_effectiveness == []
        assert report.weight_history == {}
        assert report.bypasses == []
        assert report.seeds_used == []

    def test_bypass_detail(self):
        """BypassDetail sub-model works correctly."""
        detail = BypassDetail(
            variant_id="tc_rt_seed1_encoding_001",
            seed_id="seed1",
            strategy="encoding",
            risk_pattern="R1",
        )
        assert detail.variant_id == "tc_rt_seed1_encoding_001"
        d = detail.model_dump()
        assert d["strategy"] == "encoding"

    def test_strategy_effectiveness_success_rate_bounds(self):
        """success_rate must be between 0.0 and 1.0."""
        # Valid
        s = StrategyEffectiveness(strategy="encoding", success_rate=0.5)
        assert s.success_rate == 0.5

        # Invalid
        with pytest.raises(Exception):
            StrategyEffectiveness(strategy="encoding", success_rate=2.0)


# ---------------------------------------------------------------------------
# generate_json_report() tests
# ---------------------------------------------------------------------------

class TestGenerateJsonReport:
    """Test generate_json_report() with synthetic data."""

    def test_basic_report_generation(self):
        """generate_json_report produces a valid RedTeamReport."""
        from backend.scripts.run_redteam import generate_json_report

        # Synthetic round data
        round_results = [
            [
                {
                    "test_case_id": "tc_rt_seed1_encoding_001",
                    "verdict": "PASS",
                    "risk_type": "indirect_prompt_injection",
                    "risk_pattern": "R1",
                    "severity": "HIGH",
                    "defense_labels": ["D1:InputFilter"],
                    "tool_calls": [],
                    "duration_s": 5.0,
                    "_strategy": "encoding",
                    "_seed_id": "seed1",
                },
                {
                    "test_case_id": "tc_rt_seed2_synonym_002",
                    "verdict": "PASS",
                    "risk_type": "memory_poisoning",
                    "risk_pattern": "R2",
                    "severity": "HIGH",
                    "defense_labels": ["D1:InputFilter", "D5:ChainDetector"],
                    "tool_calls": [],
                    "duration_s": 3.0,
                    "_strategy": "synonym",
                    "_seed_id": "seed2",
                },
            ]
        ]
        feedback = [
            {
                "defense_blocks": {"D1": 2, "D5": 1},
                "bypasses": [],
                "strategy_results": {
                    "encoding": {"total": 1, "bypass": 0, "blocked": 1},
                    "synonym": {"total": 1, "bypass": 0, "blocked": 1},
                },
            }
        ]
        weight_history = [{"encoding": 1.0, "synonym": 1.0}]
        seeds = [
            {"id": "seed1", "tags": ["r1"], "risk_type": "indirect_prompt_injection", "severity": "HIGH"},
            {"id": "seed2", "tags": ["r2"], "risk_type": "memory_poisoning", "severity": "HIGH"},
        ]

        report = generate_json_report(
            round_results, feedback, weight_history, seeds,
            "defended-llm-v0", 8.0,
        )

        assert isinstance(report, RedTeamReport)
        assert report.target_agent == "defended-llm-v0"
        assert report.rounds == 1
        assert report.seeds_count == 2
        assert report.variants_generated == 2
        assert report.bypasses_found == 0
        assert report.bypass_rate == 0.0
        assert report.total_time_s == 8.0

        # Round evolution
        assert len(report.round_evolution) == 1
        assert report.round_evolution[0].passed == 2

        # Defense effectiveness (D1-D8 all present)
        assert len(report.defense_effectiveness) == 8
        d1 = next(d for d in report.defense_effectiveness if d.defense_id == "D1")
        assert d1.blocks == 2

        # Strategy effectiveness
        enc = next(s for s in report.strategy_effectiveness if s.strategy == "encoding")
        assert enc.variants == 1
        assert enc.bypasses == 0

    def test_report_with_bypasses(self):
        """Report correctly captures bypass details."""
        from backend.scripts.run_redteam import generate_json_report

        round_results = [
            [
                {
                    "test_case_id": "tc_rt_seed1_social_001",
                    "verdict": "FAIL",
                    "risk_type": "indirect_prompt_injection",
                    "risk_pattern": "R1",
                    "severity": "HIGH",
                    "defense_labels": [],
                    "tool_calls": ["email.send"],
                    "duration_s": 4.0,
                    "_strategy": "social",
                    "_seed_id": "seed1",
                },
            ]
        ]
        feedback = [
            {
                "defense_blocks": {},
                "bypasses": [round_results[0][0]],
                "strategy_results": {
                    "social": {"total": 1, "bypass": 1, "blocked": 0},
                },
            }
        ]
        weight_history = [{"social": 1.0}]
        seeds = [{"id": "seed1", "tags": ["r1"], "risk_type": "indirect_prompt_injection", "severity": "HIGH"}]

        report = generate_json_report(
            round_results, feedback, weight_history, seeds,
            "llm-agent-v0", 4.0,
        )

        assert report.bypasses_found == 1
        assert report.bypass_rate == 1.0
        assert len(report.bypasses) == 1
        assert report.bypasses[0].strategy == "social"
        assert report.bypasses[0].seed_id == "seed1"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

class TestGetRedTeamReport:
    """GET /redteam/report endpoint."""

    def test_404_when_no_report(self, tmp_path):
        """Returns 404 when no report file exists."""
        # Point the report path to a non-existent file
        with patch("backend.app.api.redteam._REPORT_PATH", tmp_path / "nonexistent.json"):
            resp = client.get("/redteam/report")
            assert resp.status_code == 404
            assert "No red team report" in resp.json()["detail"]

    def test_returns_report_when_exists(self, tmp_path):
        """Returns the report JSON when the file exists."""
        report = _make_sample_report()
        report_file = tmp_path / "redteam_report.json"
        report_file.write_text(report.model_dump_json(indent=2), encoding="utf-8")

        with patch("backend.app.api.redteam._REPORT_PATH", report_file):
            resp = client.get("/redteam/report")
            assert resp.status_code == 200
            data = resp.json()
            assert data["target_agent"] == "defended-llm-v0"
            assert data["rounds"] == 2
            assert data["variants_generated"] == 16
            assert len(data["round_evolution"]) == 2
            assert len(data["defense_effectiveness"]) == 2


class TestStartRedTeam:
    """POST /redteam/start endpoint."""

    def test_parameter_validation_rounds(self):
        """Rejects invalid rounds parameter."""
        # rounds must be >= 1
        resp = client.post("/redteam/start?rounds=0")
        assert resp.status_code == 422

        # rounds must be <= 10
        resp = client.post("/redteam/start?rounds=11")
        assert resp.status_code == 422

    def test_parameter_validation_workers(self):
        """Rejects invalid workers parameter."""
        resp = client.post("/redteam/start?workers=0")
        assert resp.status_code == 422

        resp = client.post("/redteam/start?workers=9")
        assert resp.status_code == 422

    def test_start_with_mock_execution(self, tmp_path):
        """POST /redteam/start runs red team and saves report (mocked)."""
        report = _make_sample_report()
        report_file = tmp_path / "redteam_report.json"

        with (
            patch("backend.app.api.redteam._REPORT_PATH", report_file),
            patch("backend.app.api.redteam._REPORT_DIR", tmp_path),
            patch("backend.app.api.redteam._run_redteam_sync", return_value=report),
        ):
            resp = client.post(
                "/redteam/start?agent_id=defended-llm-v0&rounds=2&seeds_per_round=4"
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "completed"
            assert data["report"]["target_agent"] == "defended-llm-v0"
            assert data["report"]["rounds"] == 2

            # Report was saved to disk
            assert report_file.exists()
            saved = json.loads(report_file.read_text(encoding="utf-8"))
            assert saved["target_agent"] == "defended-llm-v0"

    def test_default_parameters(self, tmp_path):
        """POST /redteam/start works with all default parameters."""
        report = _make_sample_report()
        report_file = tmp_path / "redteam_report.json"

        with (
            patch("backend.app.api.redteam._REPORT_PATH", report_file),
            patch("backend.app.api.redteam._REPORT_DIR", tmp_path),
            patch("backend.app.api.redteam._run_redteam_sync", return_value=report) as mock_run,
        ):
            resp = client.post("/redteam/start")
            assert resp.status_code == 200

            # Verify default parameters were passed
            call_kwargs = mock_run.call_args.kwargs
            assert call_kwargs["agent_id"] == "defended-llm-v0"
            assert call_kwargs["rounds"] == 2
            assert call_kwargs["seeds_per_round"] == 4
            assert call_kwargs["variants_per_seed"] == 2
            assert call_kwargs["workers"] == 4


# ---------------------------------------------------------------------------
# OpenAPI schema test
# ---------------------------------------------------------------------------

class TestOpenAPISchema:
    """Verify redteam endpoints appear in OpenAPI schema."""

    def test_redteam_endpoints_in_schema(self):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        schema = resp.json()
        paths = schema["paths"]
        assert "/redteam/report" in paths
        assert "/redteam/start" in paths

    def test_redteam_report_fields_in_response(self):
        """GET /redteam/report response contains all expected top-level fields."""
        report = _make_sample_report()
        import tempfile
        report_file = Path(tempfile.mkdtemp()) / "redteam_report.json"
        report_file.write_text(report.model_dump_json(indent=2), encoding="utf-8")

        with patch("backend.app.api.redteam._REPORT_PATH", report_file):
            resp = client.get("/redteam/report")
            assert resp.status_code == 200
            data = resp.json()
            expected_keys = {
                "target_agent", "rounds", "seeds_count", "variants_generated",
                "bypasses_found", "bypass_rate", "total_time_s",
                "round_evolution", "defense_effectiveness",
                "strategy_effectiveness", "weight_history",
                "bypasses", "seeds_used",
            }
            assert expected_keys <= set(data.keys())
