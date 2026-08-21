"""86 TC Baseline Runner — run all 3 agents against all test cases.

Usage:
    cd csy——全智赛
    python -m backend.scripts.run_baseline [--agent AGENT_ID] [--limit N] [--sample TC_IDS]

Examples:
    python -m backend.scripts.run_baseline --agent corpmate-v0
    python -m backend.scripts.run_baseline --agent llm-agent-v0 --limit 10
    python -m backend.scripts.run_baseline --agent defended-llm-v0 --limit 10
    python -m backend.scripts.run_baseline  # all 3 agents, all TCs
"""
from __future__ import annotations

import argparse
import sys
import time
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


def _create_agent_and_judge(agent_id: str, sandbox: CompositeSandbox):
    """Factory matching evaluation_service._create_agent + _create_judge."""
    if agent_id == "corpmate-v0":
        agent = CorpMate(sandbox=sandbox)
        judge = CompositeJudge()
    elif agent_id == "llm-agent-v0":
        from backend.app.agents.llm_agent import LLMAgent
        from backend.app.llm.client import LLMClient

        agent = LLMAgent(sandbox=sandbox, llm_client=LLMClient())
        judge = CompositeJudge()
    elif agent_id == "defended-llm-v0":
        from backend.app.agents.defended_llm_agent import DefendedLLMAgent
        from backend.app.judge.llm_judge import LLMJudge
        from backend.app.llm.client import LLMClient

        agent = DefendedLLMAgent(sandbox=sandbox, llm_client=LLMClient())
        judge = CompositeJudge(llm_judge=LLMJudge(llm_client=LLMClient()))
    else:
        raise ValueError(f"Unknown agent: {agent_id}")
    return agent, judge


def _resolve_turns(tc: TestCase):
    """Get turns from scenario."""
    return tc.scenario.turns if tc.scenario.turns else []


def run_baseline(
    agent_id: str,
    test_cases: list[TestCase],
    limit: int | None = None,
    verbose: bool = True,
) -> list[dict]:
    """Run baseline evaluation for one agent.

    Returns list of {test_case_id, verdict, risk_type, risk_pattern}.
    """
    if limit:
        test_cases = test_cases[:limit]

    tool_permissions = {
        "browser.open_page": "ALLOW",
        "email.list": "ALLOW",
        "email.read": "ALLOW",
        "email.send": "CONFIRM",
        "memory.read": "ALLOW",
        "memory.write": "ALLOW",
    }

    results: list[dict] = []
    errors: list[str] = []
    t0 = time.time()

    for i, tc in enumerate(test_cases):
        sandbox = CompositeSandbox(enforce_email_confirmation=True, tool_permissions=tool_permissions)
        agent, judge = _create_agent_and_judge(agent_id, sandbox)
        adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=agent)

        try:
            adapter.reset()
            init_state = tc.scenario.initial_state.model_dump() if tc.scenario.initial_state else {}
            sandbox.reset(init_state)

            turns = _resolve_turns(tc)
            if not turns:
                # Single-turn fallback
                adapter.invoke(tc.input)
            else:
                for idx, turn in enumerate(turns):
                    if turn.starts_new_session:
                        adapter.begin_new_session()
                    if turn.env_delta:
                        adapter.apply_env_delta(turn.env_delta)
                    adapter.invoke(turn.input)

            trace = adapter.get_trace()
            judge_result = judge.evaluate(trace, tc, tool_permissions=tool_permissions)
            verdict = judge_result.verdict

        except Exception as e:
            verdict = "ERROR"
            errors.append(f"{tc.id}: {e}")
            if verbose:
                print(f"  ✗ {tc.id} ERROR: {e}")

        _TAG_TO_PATTERN = {"r1": "R1", "r2": "R2", "r3": "R3", "r4": "R4"}
        _RISK_TYPE_TO_PATTERN = {
            "indirect_prompt_injection": "R1",
            "memory_poisoning": "R2",
            "privacy_leakage": "R3",
            "persistent_indirect_prompt_injection": "R4",
        }
        risk_pattern = next(
            (_TAG_TO_PATTERN[t] for t in tc.tags if t in _TAG_TO_PATTERN),
            _RISK_TYPE_TO_PATTERN.get(tc.risk_type, "OTHER"),
        )

        results.append({
            "test_case_id": tc.id,
            "verdict": verdict,
            "risk_type": tc.risk_type,
            "risk_pattern": risk_pattern,
            "severity": tc.severity,
        })

        if verbose:
            status = "OK" if verdict == "PASS" else "XX" if verdict == "FAIL" else "??"
            defense_info = ""
            if hasattr(agent, "defense_labels") and agent.defense_labels:
                defense_info = f" [{', '.join(agent.defense_labels)}]"
            print(f"  {status} [{i+1}/{len(test_cases)}] {tc.id} -> {verdict} ({risk_pattern}){defense_info}")

    elapsed = time.time() - t0
    return results, errors, elapsed


def print_summary(agent_id: str, results: list[dict], errors: list[str], elapsed: float):
    """Print summary table."""
    total = len(results)
    passed = sum(1 for r in results if r["verdict"] == "PASS")
    failed = sum(1 for r in results if r["verdict"] == "FAIL")
    errored = sum(1 for r in results if r["verdict"] == "ERROR")

    print(f"\n{'='*60}")
    print(f"Agent: {agent_id}")
    print(f"{'='*60}")
    print(f"Total: {total} | PASS: {passed} | FAIL: {failed} | ERROR: {errored}")
    print(f"Pass Rate: {passed/total*100:.1f}% ({passed}/{total})")
    print(f"Time: {elapsed:.1f}s ({elapsed/total:.1f}s per TC)")

    # Breakdown by risk pattern
    from collections import Counter, defaultdict
    by_pattern: dict[str, dict[str, int]] = defaultdict(lambda: {"PASS": 0, "FAIL": 0, "ERROR": 0})
    for r in results:
        by_pattern[r["risk_pattern"]][r["verdict"]] += 1

    print(f"\n{'Pattern':<8} {'PASS':>6} {'FAIL':>6} {'ERROR':>6} {'Rate':>8}")
    print(f"{'-'*36}")
    for pattern in sorted(by_pattern):
        counts = by_pattern[pattern]
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


def main():
    parser = argparse.ArgumentParser(description="86 TC Baseline Runner")
    parser.add_argument("--agent", type=str, help="Agent ID (corpmate-v0, llm-agent-v0, defended-llm-v0)")
    parser.add_argument("--limit", type=int, help="Limit number of TCs")
    parser.add_argument("--quiet", action="store_true", help="Suppress per-TC output")
    args = parser.parse_args()

    raw_cases = load_all_test_case_files()
    test_cases = [TestCase.model_validate(raw) for raw in raw_cases]
    print(f"Loaded {len(test_cases)} test cases")

    agents = [args.agent] if args.agent else ["corpmate-v0", "llm-agent-v0", "defended-llm-v0"]

    for agent_id in agents:
        print(f"\n{'#'*60}")
        print(f"# Running: {agent_id}")
        print(f"{'#'*60}")
        results, errors, elapsed = run_baseline(
            agent_id, test_cases, limit=args.limit, verbose=not args.quiet
        )
        print_summary(agent_id, results, errors, elapsed)


if __name__ == "__main__":
    main()
