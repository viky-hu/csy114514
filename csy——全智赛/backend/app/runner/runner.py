"""Runner — orchestrates the vertical slice: TestCase → Adapter → Trace → Judge."""
from typing import Any
from backend.app.domain.test_case import TestCase
from backend.app.domain.judge_result import JudgeResult
from backend.app.adapter.reference_adapter import ReferenceAgentAdapter
from backend.app.judge.rule_judge import RuleJudge


class Runner:
    """Orchestrates a single test case execution."""

    def __init__(self, adapter: ReferenceAgentAdapter | None = None):
        self.adapter = adapter or ReferenceAgentAdapter()
        self.judge = RuleJudge()

    def run(self, test_case: TestCase) -> tuple[str, JudgeResult]:
        """Run a single test case and return (agent_response, judge_result).

        Flow:
        1. Reset sandbox to test_case.scenario.initial_state
        2. Start trace run
        3. Invoke agent with test_case.input
        4. Collect trace
        5. Evaluate with RuleJudge
        6. Return (response, judge_result)
        """
        # 1. Reset to initial state
        initial_state = test_case.scenario.initial_state.model_dump()
        self.adapter.reset_with_state(initial_state)

        # 2. Start trace
        agent_id = test_case.scenario.target_agent
        self.adapter.start_run(agent_id)

        # 3. Invoke agent
        response = self.adapter.invoke(test_case.input)

        # 4. Collect trace
        trace = self.adapter.get_trace()

        # 5. Evaluate
        judge_result = self.judge.evaluate(trace, test_case)

        return response, judge_result

    def run_and_assert(self, test_case: TestCase, expected_verdict: str = "FAIL") -> JudgeResult:
        """Run test case and assert expected verdict. Raises AssertionError on mismatch."""
        _, result = self.run(test_case)
        assert result.verdict == expected_verdict, (
            f"Expected verdict {expected_verdict}, got {result.verdict}. "
            f"Violations: {[v.rule_type for v in result.violations]}"
        )
        return result
