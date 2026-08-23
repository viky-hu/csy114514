from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from backend.app.api.evaluations import _comparison_cursor_from_event_id
from backend.app.domain.evaluation_comparison import (
    EvaluationComparison,
    compare_case_results,
    summarize_comparison,
)
from backend.app.main import app
from backend.app.services import evaluation_service


def test_comparison_pairs_same_test_cases_and_counts_defense_blocked():
    result = compare_case_results(
        [
            {
                "test_case_id": "tc-1",
                "verdict": "FAIL",
                "findings": [{"finding_id": "finding-1", "severity": "HIGH"}],
            },
            {"test_case_id": "tc-2", "verdict": "PASS"},
            {"test_case_id": "tc-3", "verdict": "ERROR"},
        ],
        [
            {"test_case_id": "tc-1", "verdict": "PASS"},
            {"test_case_id": "tc-2", "verdict": "PASS"},
            {"test_case_id": "tc-3", "verdict": "PASS"},
        ],
    )

    assert [row.test_case_id for row in result] == ["tc-1", "tc-2", "tc-3"]
    assert result[0].transition == "defense_blocked"
    assert result[0].bare_findings == [{"finding_id": "finding-1", "severity": "HIGH"}]
    assert result[1].transition == "both_pass"
    assert result[2].transition == "incomplete"

    summary = summarize_comparison(result)
    assert summary.total == 3
    assert summary.comparable == 2
    assert summary.defense_blocked == 1
    assert summary.bare_pass_rate == pytest.approx(0.5)
    assert summary.defended_pass_rate == pytest.approx(1.0)
    assert summary.pass_rate_delta == pytest.approx(0.5)


def test_comparison_preserves_selected_order_when_a_side_has_no_result():
    result = compare_case_results(
        [{"test_case_id": "tc-2", "verdict": "PASS"}],
        [],
        ["tc-1", "tc-2"],
    )
    assert [row.test_case_id for row in result] == ["tc-1", "tc-2"]
    assert result[0].transition == "incomplete"
    assert result[1].transition == "incomplete"


def test_comparison_model_rejects_non_official_pair():
    with pytest.raises(ValueError):
        EvaluationComparison(
            comparison_id="cmp-1",
            mode="bare_vs_defended",
            test_case_ids=["tc-1"],
            bare_run_id="run-bare",
            defended_run_id=None,
            status="creating",
            comparison_seed="seed-1",
            created_at=datetime.now(timezone.utc),
            bare_agent_id="corpmate-v0",
            defended_agent_id="defended-llm-v0",
        )


def test_comparison_event_cursor_accepts_only_its_own_stream_id():
    assert _comparison_cursor_from_event_id("cmp-1", "cmp-1:12") == 12
    assert _comparison_cursor_from_event_id("cmp-1", "cmp-2:12") == 0
    assert _comparison_cursor_from_event_id("cmp-1", "cmp-1:not-a-number") == 0


@pytest_asyncio.fixture
async def comparison_client(tmp_path):
    evaluation_service.configure(
        database_path=tmp_path / "comparisons.sqlite3",
        fingerprint_key="test-fingerprint-key-with-sufficient-entropy",
        start_worker=False,
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as value:
        yield value
    evaluation_service.shutdown()


@pytest.mark.asyncio
async def test_comparison_runs_bare_then_defended_and_returns_projection(comparison_client, monkeypatch):
    from backend.app.corpmate.agent import CorpMate

    monkeypatch.setattr(
        evaluation_service.EvaluationCoordinator,
        "_create_agent",
        staticmethod(lambda _agent_id, sandbox: CorpMate(sandbox=sandbox)),
    )
    monkeypatch.setattr(
        evaluation_service.EvaluationCoordinator,
        "_create_judge",
        staticmethod(lambda _agent_id: evaluation_service.CompositeJudge()),
    )
    created = await comparison_client.post(
        "/evaluations/comparisons",
        json={
            "request_id": "comparison-001",
            "test_case_ids": ["tc_pi_001", "tc_unauth_001"],
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["status"] == "running_bare"
    assert body["bare_run_id"]
    assert body["defended_run_id"]

    assert evaluation_service.coordinator().process_queued_once() is True
    after_bare = await comparison_client.get(f"/evaluations/comparisons/{body['comparison_id']}")
    assert after_bare.json()["status"] == "running_defended"

    assert evaluation_service.coordinator().process_queued_once() is True
    completed = await comparison_client.get(f"/evaluations/comparisons/{body['comparison_id']}")
    assert completed.json()["status"] == "completed"

    report = await comparison_client.get(
        f"/evaluations/comparisons/{body['comparison_id']}/report"
    )
    assert report.status_code == 200
    assert report.json()["summary"]["total"] == 2
    assert len(report.json()["results"]) == 2
