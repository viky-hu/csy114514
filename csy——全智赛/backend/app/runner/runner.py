"""Runner — orchestrates TestCase execution: TestCase → turns → Adapter → Sandbox → Trace → Judge."""
from backend.app.domain.test_case import TestCase
from backend.app.domain.test_scenario import ScenarioTurn
from backend.app.domain.judge_result import JudgeResult
from backend.app.adapter.reference_adapter import ReferenceAgentAdapter
from backend.app.judge.rule_judge import RuleJudge


class Runner:
    """Orchestrates a single test case execution (multi-turn, L4)."""

    def __init__(self, adapter: ReferenceAgentAdapter | None = None):
        self.adapter = adapter or ReferenceAgentAdapter()
        self.judge = RuleJudge()

    def run(self, test_case: TestCase) -> tuple[str, JudgeResult]:
        """Run a test case and return (last_response, judge_result).

        Flow (SECURITY_CONTRACTS §9.3 / runner coordination brief):
        1. Reset sandbox once to test_case.scenario.initial_state
        2. Resolve turns: scenario.turns 非空则循环, 否则包装顶层 input 为单轮
        3. 每轮: 先 apply env_delta (增量合并, 不 reset), 再 invoke agent
        4. Memory 跨 turn 持久化
        5. Collect trace and evaluate with RuleJudge
        """
        turns = self._resolve_turns(test_case)

        # 1. Reset to initial state (once per test case)
        initial_state = test_case.scenario.initial_state.model_dump()
        self.adapter.reset_with_state(initial_state)

        # 2. Start trace
        agent_id = test_case.scenario.target_agent
        self.adapter.start_run(agent_id)

        # 3. Execute turns
        last_response = ""
        for turn in turns:
            # env_delta: 增量合并到 Sandbox (不 reset, Memory 跨 turn 持久化)
            if turn.env_delta:
                self.adapter.apply_env_delta(turn.env_delta)
            if turn.starts_new_session:
                self.adapter.begin_new_session()
            last_response = self.adapter.invoke(turn.input)

        # 4. Collect trace
        trace = self.adapter.get_trace()

        # 5. Evaluate
        judge_result = self.judge.evaluate(trace, test_case)

        return last_response, judge_result

    @staticmethod
    def _resolve_turns(test_case: TestCase) -> list[ScenarioTurn]:
        """L4: turns 非空优先, 否则顶层 input 包装为单轮 (向后兼容)."""
        if test_case.scenario and test_case.scenario.turns:
            return test_case.scenario.turns
        if test_case.input:
            return [
                ScenarioTurn(
                    turn_id="single",
                    input=test_case.input,
                    starts_new_session=True,
                )
            ]
        raise ValueError("no input or turns")

    def run_and_assert(self, test_case: TestCase, expected_verdict: str = "FAIL") -> JudgeResult:
        """Run test case and assert expected verdict. Raises AssertionError on mismatch."""
        _, result = self.run(test_case)
        assert result.verdict == expected_verdict, (
            f"Expected verdict {expected_verdict}, got {result.verdict}. "
            f"Violations: {[v.rule_type for v in result.violations]}"
        )
        return result