"""Domain models and deterministic projections for Bare vs Defended runs."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

ComparisonMode = Literal["bare_vs_defended"]
ComparisonStatus = Literal[
    "creating",
    "queued",
    "running_bare",
    "running_defended",
    "completed",
    "partial",
    "failed",
]
ComparisonSide = Literal["bare", "defended"]
ComparisonTransition = Literal[
    "defense_blocked",
    "both_pass",
    "defense_failed",
    "possible_regression",
    "incomplete",
]


class ComparisonCaseResult(BaseModel):
    test_case_id: str = Field(..., min_length=1)
    bare_verdict: str | None = None
    defended_verdict: str | None = None
    transition: ComparisonTransition
    bare_findings: list[dict[str, object]] = Field(default_factory=list)
    defended_findings: list[dict[str, object]] = Field(default_factory=list)


class ComparisonSummary(BaseModel):
    total: int = Field(..., ge=0)
    comparable: int = Field(..., ge=0)
    bare_passed: int = Field(..., ge=0)
    defended_passed: int = Field(..., ge=0)
    defense_blocked: int = Field(..., ge=0)
    bare_pass_rate: float = Field(..., ge=0, le=1)
    defended_pass_rate: float = Field(..., ge=0, le=1)
    pass_rate_delta: float


class EvaluationComparison(BaseModel):
    comparison_id: str = Field(..., min_length=1)
    mode: ComparisonMode
    test_case_ids: list[str] = Field(..., min_length=1)
    bare_run_id: str = Field(..., min_length=1)
    defended_run_id: str | None = None
    status: ComparisonStatus
    comparison_seed: str = Field(..., min_length=1)
    created_at: datetime
    bare_agent_id: str = "llm-agent-v0"
    defended_agent_id: str = "defended-llm-v0"

    @model_validator(mode="after")
    def validate_official_pair(self) -> EvaluationComparison:
        if self.bare_agent_id != "llm-agent-v0" or self.defended_agent_id != "defended-llm-v0":
            raise ValueError("comparison mode only supports llm-agent-v0 vs defended-llm-v0")
        if len(set(self.test_case_ids)) != len(self.test_case_ids):
            raise ValueError("test_case_ids must be unique")
        return self


def _verdict(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.upper()
    return normalized


def _transition(bare: str | None, defended: str | None) -> ComparisonTransition:
    if bare == "FAIL" and defended == "PASS":
        return "defense_blocked"
    if bare == "PASS" and defended == "PASS":
        return "both_pass"
    if bare == "FAIL" and defended == "FAIL":
        return "defense_failed"
    if bare == "PASS" and defended == "FAIL":
        return "possible_regression"
    return "incomplete"


def compare_case_results(
    bare_results: Sequence[Mapping[str, object]],
    defended_results: Sequence[Mapping[str, object]],
    test_case_ids: Sequence[str] | None = None,
) -> list[ComparisonCaseResult]:
    defended_by_id = {
        str(item["test_case_id"]): _verdict(item.get("verdict"))
        for item in defended_results
        if isinstance(item.get("test_case_id"), str)
    }
    bare_by_id = {
        str(item["test_case_id"]): _verdict(item.get("verdict"))
        for item in bare_results
        if isinstance(item.get("test_case_id"), str)
    }
    ordered_ids = list(test_case_ids or ())
    ordered_ids.extend(test_case_id for test_case_id in bare_by_id if test_case_id not in ordered_ids)
    ordered_ids.extend(test_case_id for test_case_id in defended_by_id if test_case_id not in ordered_ids)
    return [
        ComparisonCaseResult(
            test_case_id=test_case_id,
            bare_verdict=bare_by_id.get(test_case_id),
            defended_verdict=defended_by_id.get(test_case_id),
            transition=_transition(bare_by_id.get(test_case_id), defended_by_id.get(test_case_id)),
            bare_findings=_findings_for(bare_results, test_case_id),
            defended_findings=_findings_for(defended_results, test_case_id),
        )
        for test_case_id in ordered_ids
    ]


def _findings_for(results: Sequence[Mapping[str, object]], test_case_id: str) -> list[dict[str, object]]:
    for item in results:
        if item.get("test_case_id") != test_case_id:
            continue
        findings = item.get("findings")
        if not isinstance(findings, list):
            return []
        return [finding for finding in findings if isinstance(finding, dict)]
    return []


def summarize_comparison(results: Sequence[ComparisonCaseResult]) -> ComparisonSummary:
    comparable = [
        result
        for result in results
        if result.bare_verdict in {"PASS", "FAIL"}
        and result.defended_verdict in {"PASS", "FAIL"}
    ]
    total = len(results)
    bare_passed = sum(result.bare_verdict == "PASS" for result in comparable)
    defended_passed = sum(result.defended_verdict == "PASS" for result in comparable)
    comparable_count = len(comparable)
    bare_rate = bare_passed / comparable_count if comparable_count else 0.0
    defended_rate = defended_passed / comparable_count if comparable_count else 0.0
    return ComparisonSummary(
        total=total,
        comparable=comparable_count,
        bare_passed=bare_passed,
        defended_passed=defended_passed,
        defense_blocked=sum(result.transition == "defense_blocked" for result in comparable),
        bare_pass_rate=bare_rate,
        defended_pass_rate=defended_rate,
        pass_rate_delta=defended_rate - bare_rate,
    )
