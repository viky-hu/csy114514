"""86 TC Baseline Runner — run all 3 agents against all test cases.

Usage:
    cd csy——全智赛
    python -m backend.scripts.run_baseline [options]

Options:
    --agent AGENT_ID     Run one agent (corpmate-v0 / llm-agent-v0 / defended-llm-v0)
    --limit N            Limit number of TCs
    --quiet              Suppress per-TC console output
    --output FILE        Export results to file (.json / .csv / .md)
    --format FMT         Force format: json / csv / markdown (auto from extension)

Examples:
    # Run all 3 agents, export JSON
    python -m backend.scripts.run_baseline --output results.json

    # Run one agent, export CSV
    python -m backend.scripts.run_baseline --agent defended-llm-v0 --output defended.csv

    # Quick CorpMate check, export markdown
    python -m backend.scripts.run_baseline --agent corpmate-v0 --output report.md
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is on sys.path
_project_root = Path(__file__).resolve().parents[2]
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from backend.app.adapter.reference_adapter import ReferenceAgentAdapter
from backend.app.corpmate.agent import CorpMate
from backend.app.domain.test_case import TestCase
from backend.app.judge.composite_judge import CompositeJudge
from backend.app.knowledge.kb_loader import load_all_test_case_files
from backend.app.sandbox.composite import CompositeSandbox

_TAG_TO_PATTERN = {"r1": "R1", "r2": "R2", "r3": "R3", "r4": "R4"}
_RISK_TYPE_TO_PATTERN = {
    "indirect_prompt_injection": "R1",
    "memory_poisoning": "R2",
    "privacy_leakage": "R3",
    "persistent_indirect_prompt_injection": "R4",
}


def _create_agent_and_judge(agent_id: str, sandbox: CompositeSandbox, llm_client=None):
    """Factory matching evaluation_service._create_agent + _create_judge.

    Args:
        agent_id: Agent identifier
        sandbox: Fresh sandbox instance
        llm_client: Optional shared LLMClient (for cache reuse across TCs)
    """
    if agent_id == "corpmate-v0":
        agent = CorpMate(sandbox=sandbox)
        judge = CompositeJudge()
    elif agent_id == "llm-agent-v0":
        from backend.app.agents.llm_agent import LLMAgent
        from backend.app.llm.client import LLMClient

        client = llm_client or LLMClient()
        agent = LLMAgent(sandbox=sandbox, llm_client=client)
        judge = CompositeJudge()
    elif agent_id == "defended-llm-v0":
        from backend.app.agents.defended_llm_agent import DefendedLLMAgent
        from backend.app.judge.llm_judge import LLMJudge
        from backend.app.llm.client import LLMClient

        client = llm_client or LLMClient()
        agent = DefendedLLMAgent(sandbox=sandbox, llm_client=client)
        judge = CompositeJudge(llm_judge=LLMJudge(llm_client=client))
    else:
        raise ValueError(f"Unknown agent: {agent_id}")
    return agent, judge


def _resolve_turns(tc: TestCase):
    """Get turns from scenario."""
    return tc.scenario.turns if tc.scenario.turns else []


def _get_risk_pattern(tc: TestCase) -> str:
    return next(
        (_TAG_TO_PATTERN[t] for t in tc.tags if t in _TAG_TO_PATTERN),
        _RISK_TYPE_TO_PATTERN.get(tc.risk_type, "OTHER"),
    )


_TOOL_PERMISSIONS = {
    "browser.open_page": "ALLOW",
    "email.list": "ALLOW",
    "email.read": "ALLOW",
    "email.send": "CONFIRM",
    "memory.read": "ALLOW",
    "memory.write": "ALLOW",
}


def _run_single_tc(agent_id: str, tc: TestCase, llm_client=None) -> dict:
    """Run one TC in isolation — thread-safe (each TC gets its own sandbox/agent).

    Args:
        agent_id: Agent identifier
        tc: Test case to run
        llm_client: Optional shared LLMClient (for cache reuse across TCs)

    Returns a result dict. Raises on error (caller catches).
    """
    sandbox = CompositeSandbox(
        enforce_email_confirmation=True, tool_permissions=_TOOL_PERMISSIONS
    )
    agent, judge = _create_agent_and_judge(agent_id, sandbox, llm_client=llm_client)
    adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=agent)

    defense_labels: list[str] = []
    tool_calls: list[dict] = []
    verdict = "ERROR"
    tc_t0 = time.time()

    adapter.reset()
    init_state = (
        tc.scenario.initial_state.model_dump()
        if tc.scenario.initial_state
        else {}
    )
    sandbox.reset(init_state)

    turns = _resolve_turns(tc)
    if not turns:
        adapter.invoke(tc.input)
    else:
        for turn in turns:
            if turn.starts_new_session:
                adapter.begin_new_session()
            if turn.env_delta:
                adapter.apply_env_delta(turn.env_delta)
            adapter.invoke(turn.input)

    trace = adapter.get_trace()
    judge_result = judge.evaluate(trace, tc, tool_permissions=_TOOL_PERMISSIONS)
    verdict = judge_result.verdict

    # Collect defense labels
    if hasattr(agent, "defense_labels"):
        defense_labels = list(agent.defense_labels)

    # Collect tool calls from trace
    for evt in trace.events:
        if evt.type.value == "TOOL_CALLED":
            p = evt.payload
            tool_calls.append({
                "tool_name": p.get("tool_name", ""),
                "confirmed": p.get("confirmed", False),
            })

    tc_duration = time.time() - tc_t0
    risk_pattern = _get_risk_pattern(tc)

    return {
        "test_case_id": tc.id,
        "verdict": verdict,
        "risk_type": tc.risk_type,
        "risk_pattern": risk_pattern,
        "severity": tc.severity,
        "defense_labels": defense_labels,
        "tool_calls": tool_calls,
        "duration_s": round(tc_duration, 2),
    }


def run_baseline(
    agent_id: str,
    test_cases: list[TestCase],
    limit: int | None = None,
    verbose: bool = True,
    workers: int = 1,
) -> tuple[list[dict], list[str], float]:
    """Run baseline evaluation for one agent.

    Args:
        agent_id: Agent to evaluate
        test_cases: List of test cases
        limit: Limit number of TCs (None = all)
        verbose: Print per-TC progress
        workers: Number of parallel workers (1 = sequential)

    Returns (results, errors, elapsed_seconds, cache_stats).
    """
    if limit:
        test_cases = test_cases[:limit]

    results: list[dict] = []
    errors: list[str] = []
    t0 = time.time()
    total = len(test_cases)

    # Create shared LLM client for cache reuse across TCs
    shared_llm = None
    if agent_id in ("llm-agent-v0", "defended-llm-v0"):
        from backend.app.llm.client import LLMClient
        shared_llm = LLMClient()

    if workers <= 1:
        # Sequential execution (original behavior)
        for i, tc in enumerate(test_cases):
            tc_t0 = time.time()
            try:
                result = _run_single_tc(agent_id, tc, llm_client=shared_llm)
            except Exception as e:
                errors.append(f"{tc.id}: {e}")
                if verbose:
                    print(f"  ?? [{i+1}/{total}] {tc.id} ERROR: {e}")
                result = {
                    "test_case_id": tc.id,
                    "verdict": "ERROR",
                    "risk_type": tc.risk_type,
                    "risk_pattern": _get_risk_pattern(tc),
                    "severity": tc.severity,
                    "defense_labels": [],
                    "tool_calls": [],
                    "duration_s": round(time.time() - tc_t0, 2),
                }

            results.append(result)
            if verbose:
                _print_progress(result, i + 1, total)
    else:
        # Parallel execution
        print_lock = threading.Lock()
        completed_count = 0

        def _run_and_report(tc: TestCase, idx: int) -> dict:
            nonlocal completed_count
            try:
                result = _run_single_tc(agent_id, tc, llm_client=shared_llm)
            except Exception as e:
                result = {
                    "test_case_id": tc.id,
                    "verdict": "ERROR",
                    "risk_type": tc.risk_type,
                    "risk_pattern": _get_risk_pattern(tc),
                    "severity": tc.severity,
                    "defense_labels": [],
                    "tool_calls": [],
                    "duration_s": 0.0,
                    "_error": str(e),
                }
            with print_lock:
                completed_count += 1
                if verbose:
                    _print_progress(result, completed_count, total)
            return result

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(_run_and_report, tc, i): tc
                for i, tc in enumerate(test_cases)
            }
            for future in as_completed(futures):
                result = future.result()
                if "_error" in result:
                    errors.append(f"{result['test_case_id']}: {result.pop('_error')}")
                results.append(result)

    # Sort results by original TC order (parallel execution scrambles order)
    tc_order = {tc.id: i for i, tc in enumerate(test_cases)}
    results.sort(key=lambda r: tc_order.get(r["test_case_id"], 999))

    elapsed = time.time() - t0

    # Collect cache stats
    cache_stats = {}
    if shared_llm and hasattr(shared_llm, "cache_stats"):
        cache_stats = shared_llm.cache_stats

    return results, errors, elapsed, cache_stats


def _print_progress(result: dict, current: int, total: int) -> None:
    """Print one-line TC progress (thread-safe when called under lock)."""
    verdict = result["verdict"]
    status = "OK" if verdict == "PASS" else "XX" if verdict == "FAIL" else "??"
    defense_labels = result.get("defense_labels", [])
    d_info = f" [{', '.join(defense_labels)}]" if defense_labels else ""
    duration = result.get("duration_s", 0)
    print(
        f"  {status} [{current}/{total}] {result['test_case_id']} -> "
        f"{verdict} ({result['risk_pattern']}){d_info} ({duration:.1f}s)"
    )


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def _compute_summary(results: list[dict]) -> dict:
    total = len(results)
    passed = sum(1 for r in results if r["verdict"] == "PASS")
    failed = sum(1 for r in results if r["verdict"] == "FAIL")
    errored = sum(1 for r in results if r["verdict"] == "ERROR")
    by_pattern: dict[str, dict[str, int]] = defaultdict(
        lambda: {"PASS": 0, "FAIL": 0, "ERROR": 0}
    )
    for r in results:
        by_pattern[r["risk_pattern"]][r["verdict"]] += 1
    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "error": errored,
        "pass_rate": round(passed / total, 4) if total else 0,
        "by_risk_pattern": {k: dict(v) for k, v in sorted(by_pattern.items())},
    }


def print_summary(agent_id: str, results: list[dict], errors: list[str], elapsed: float):
    """Print summary table to console."""
    s = _compute_summary(results)
    total = s["total"]

    print(f"\n{'='*60}")
    print(f"Agent: {agent_id}")
    print(f"{'='*60}")
    print(f"Total: {total} | PASS: {s['passed']} | FAIL: {s['failed']} | ERROR: {s['error']}")
    print(f"Pass Rate: {s['pass_rate']*100:.1f}% ({s['passed']}/{total})")
    print(f"Time: {elapsed:.1f}s ({elapsed/total:.1f}s per TC)" if total else "")

    print(f"\n{'Pattern':<8} {'PASS':>6} {'FAIL':>6} {'ERROR':>6} {'Rate':>8}")
    print(f"{'-'*36}")
    for pattern, counts in sorted(s["by_risk_pattern"].items()):
        p, f, e = counts["PASS"], counts["FAIL"], counts["ERROR"]
        t = p + f + e
        rate = f"{p/t*100:.0f}%" if t > 0 else "N/A"
        print(f"{pattern:<8} {p:>6} {f:>6} {e:>6} {rate:>8}")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for err in errors[:5]:
            print(f"  - {err}")
        if len(errors) > 5:
            print(f"  ... and {len(errors)-5} more")


# ---------------------------------------------------------------------------
# Export functions
# ---------------------------------------------------------------------------

def _detect_format(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    return {"json": "json", ".csv": "csv", ".md": "markdown", ".markdown": "markdown"}.get(ext, "json")


def export_json(all_runs: dict[str, dict], filepath: str):
    """Export all runs to a single JSON file."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(all_runs, f, ensure_ascii=False, indent=2)
    print(f"\nExported JSON -> {filepath}")


def export_csv(all_runs: dict[str, dict], filepath: str):
    """Export all runs to CSV with agent_id column."""
    fieldnames = [
        "agent_id", "test_case_id", "verdict", "risk_type",
        "risk_pattern", "severity", "defense_labels",
        "tool_calls_count", "duration_s",
    ]
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for agent_id, run_data in all_runs.items():
            for r in run_data["results"]:
                writer.writerow({
                    "agent_id": agent_id,
                    "test_case_id": r["test_case_id"],
                    "verdict": r["verdict"],
                    "risk_type": r["risk_type"],
                    "risk_pattern": r["risk_pattern"],
                    "severity": r["severity"],
                    "defense_labels": "; ".join(r.get("defense_labels", [])),
                    "tool_calls_count": len(r.get("tool_calls", [])),
                    "duration_s": r.get("duration_s", 0),
                })
    print(f"\nExported CSV -> {filepath}")


def export_markdown(all_runs: dict[str, dict], filepath: str):
    """Export comparison report in Markdown."""
    lines: list[str] = []
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines.append(f"# 98 TC Baseline Report")
    lines.append(f"")
    lines.append(f"Generated: {timestamp}")
    lines.append(f"")

    # Summary comparison table
    lines.append("## Summary Comparison")
    lines.append("")
    lines.append("| Agent | PASS | FAIL | ERROR | Pass Rate | Time |")
    lines.append("|-------|------|------|-------|-----------|------|")
    for agent_id, run_data in all_runs.items():
        s = run_data["summary"]
        elapsed = run_data["elapsed_s"]
        short = agent_id.replace("-v0", "")
        lines.append(
            f"| {short} | {s['passed']} | {s['failed']} | {s['error']} "
            f"| {s['pass_rate']*100:.1f}% | {elapsed:.1f}s |"
        )
    lines.append("")

    # Per-pattern comparison
    all_patterns = sorted(
        set().union(
            *(run_data["summary"]["by_risk_pattern"].keys() for run_data in all_runs.values())
        )
    )
    lines.append("## By Risk Pattern")
    lines.append("")
    header = "| Pattern | " + " | ".join(
        a.replace("-v0", "") for a in all_runs
    ) + " |"
    sep = "|---------|" + "|".join("------" for _ in all_runs) + "|"
    lines.append(header)
    lines.append(sep)
    for pattern in all_patterns:
        cells = []
        for run_data in all_runs.values():
            c = run_data["summary"]["by_risk_pattern"].get(
                pattern, {"PASS": 0, "FAIL": 0, "ERROR": 0}
            )
            t = c["PASS"] + c["FAIL"] + c["ERROR"]
            rate = f"{c['PASS']}/{t}" if t else "N/A"
            cells.append(rate)
        lines.append(f"| {pattern} | " + " | ".join(cells) + " |")
    lines.append("")

    # FAIL details
    lines.append("## Failure Details")
    lines.append("")
    any_fail = False
    for agent_id, run_data in all_runs.items():
        fails = [r for r in run_data["results"] if r["verdict"] == "FAIL"]
        if fails:
            any_fail = True
            lines.append(f"### {agent_id}")
            lines.append("")
            for r in fails:
                tools = ", ".join(
                    tc["tool_name"] for tc in r.get("tool_calls", [])
                )
                defenses = "; ".join(r.get("defense_labels", [])) or "none"
                lines.append(
                    f"- **{r['test_case_id']}** ({r['risk_pattern']}) "
                    f"tools=[{tools}] defenses=[{defenses}]"
                )
            lines.append("")
    if not any_fail:
        lines.append("No failures across all agents.")
        lines.append("")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\nExported Markdown -> {filepath}")


def export_results(
    all_runs: dict[str, dict], filepath: str, fmt: str | None = None
):
    """Export results to the specified file.

    Args:
        all_runs: {agent_id: {"results": [...], "errors": [...],
                    "elapsed_s": float, "summary": {...}}}
        filepath: Output file path
        fmt: Force format (json/csv/markdown). Auto-detected from extension if None.
    """
    if fmt is None:
        fmt = _detect_format(filepath)

    exporters = {"json": export_json, "csv": export_csv, "markdown": export_markdown}
    exporter = exporters.get(fmt)
    if not exporter:
        print(f"Unknown format: {fmt}. Supported: json, csv, markdown")
        return
    exporter(all_runs, filepath)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="86 TC Baseline Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m backend.scripts.run_baseline --output results.json\n"
            "  python -m backend.scripts.run_baseline --agent corpmate-v0 --output report.md\n"
            "  python -m backend.scripts.run_baseline --agent defended-llm-v0 --output data.csv\n"
        ),
    )
    parser.add_argument(
        "--agent", type=str,
        help="Agent ID (corpmate-v0, llm-agent-v0, defended-llm-v0). "
             "Default: run all 3.",
    )
    parser.add_argument("--limit", type=int, help="Limit number of TCs")
    parser.add_argument(
        "--workers", type=int, default=1,
        help="Number of parallel workers (default: 1, max recommended: 8)",
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress per-TC output")
    parser.add_argument(
        "--output", type=str,
        help="Export results to file (.json / .csv / .md)",
    )
    parser.add_argument(
        "--format", type=str, choices=["json", "csv", "markdown"],
        help="Force export format (auto-detected from extension if omitted)",
    )
    args = parser.parse_args()

    raw_cases = load_all_test_case_files()
    test_cases = [TestCase.model_validate(raw) for raw in raw_cases]
    print(f"Loaded {len(test_cases)} test cases")

    agents = (
        [args.agent] if args.agent
        else ["corpmate-v0", "llm-agent-v0", "defended-llm-v0"]
    )

    all_runs: dict[str, dict] = {}

    for agent_id in agents:
        print(f"\n{'#'*60}")
        print(f"# Running: {agent_id} (workers={args.workers})")
        print(f"{'#'*60}")
        results, errors, elapsed, cache_stats = run_baseline(
            agent_id, test_cases, limit=args.limit, verbose=not args.quiet,
            workers=args.workers,
        )
        print_summary(agent_id, results, errors, elapsed)

        # Print cache stats if available
        if cache_stats:
            total_calls = cache_stats.get("hits", 0) + cache_stats.get("misses", 0)
            if total_calls > 0:
                hit_rate = cache_stats["hits"] / total_calls * 100
                print(
                    f"LLM Cache: {cache_stats['hits']} hits / {cache_stats['misses']} misses "
                    f"({hit_rate:.0f}% hit rate)"
                )

        all_runs[agent_id] = {
            "results": results,
            "errors": errors,
            "elapsed_s": round(elapsed, 2),
            "summary": _compute_summary(results),
        }

    if args.output:
        export_results(all_runs, args.output, args.format)


if __name__ == "__main__":
    main()
