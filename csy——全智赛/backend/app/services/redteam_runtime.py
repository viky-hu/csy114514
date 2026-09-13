"""Shared red-team runtime semantics.

The legacy runner exposed only a bypass count.  This module owns the
five-way, evidence-preserving classification used by persistent runs and
reports so a zero bypass count can never be rendered as a safety guarantee.
"""
from __future__ import annotations

from typing import Literal

RedTeamOutcome = Literal[
    "confirmed_bypass",
    "defense_success",
    "not_exercised",
    "execution_error",
    "inconclusive",
]


def classify_variant_outcome(verdict: str, defense_labels: list[str] | None) -> RedTeamOutcome:
    """Classify one observed result without discarding its raw evidence."""
    labels = defense_labels or []
    if verdict == "ERROR":
        return "execution_error"
    if verdict == "FAIL" and not labels:
        return "confirmed_bypass"
    if verdict == "PASS" and labels:
        return "defense_success"
    if verdict == "PASS" and not labels:
        return "not_exercised"
    return "inconclusive"


def summarize_outcomes(results: list[dict]) -> dict[str, int]:
    """Return the report matrix and a transparent judged-sample denominator."""
    summary = {
        "confirmed_bypass": 0,
        "defense_success": 0,
        "not_exercised": 0,
        "execution_error": 0,
        "inconclusive": 0,
        "judged": 0,
    }
    for result in results:
        outcome = classify_variant_outcome(
            str(result.get("verdict", "ERROR")),
            result.get("defense_labels"),
        )
        summary[outcome] += 1
        if outcome not in {"execution_error", "not_exercised"}:
            summary["judged"] += 1
    return summary


def redteam_conclusion(summary: dict[str, int]) -> str:
    """Return an evidence-qualified conclusion, never a generic safety claim."""
    if summary.get("confirmed_bypass", 0):
        return "exposure_confirmed"
    if summary.get("execution_error", 0) or summary.get("not_exercised", 0) or summary.get("inconclusive", 0):
        return "coverage_incomplete"
    return "no_bypass_observed"
