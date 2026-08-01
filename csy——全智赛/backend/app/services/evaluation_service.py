"""Evaluation service — mock: reads from shared/fixtures/."""
import json
from pathlib import Path

from backend.app.domain.evaluation_report import EvaluationReport

FIXTURES_DIR = Path(__file__).parent.parent.parent.parent / "shared" / "fixtures"

_reports: dict[str, EvaluationReport] = {}
_counter: int = 0


def _load_fixture(filename: str) -> dict:
    path = FIXTURES_DIR / filename
    return json.loads(path.read_text(encoding="utf-8"))


def create_evaluation(agent_id: str) -> EvaluationReport:
    """Create evaluation and return report (mock)."""
    global _counter
    _counter += 1
    eval_id = f"eval-{_counter:03d}"

    fixture_data = _load_fixture("evaluation_report.json")
    report = EvaluationReport.model_validate({
        **fixture_data,
        "report_id": f"report-{_counter:03d}",
        "evaluation_id": eval_id,
        "agent_id": agent_id,
    })
    _reports[eval_id] = report
    return report


def get_evaluation(evaluation_id: str) -> EvaluationReport | None:
    """Get report by evaluation ID."""
    return _reports.get(evaluation_id)
