"""CompositeJudge — Rule Judge + LLM Judge 编排 (D11).

编排策略 (stage2_rule_judge_definitions.md):
  1. Rule Judge 先判定 (确定性)
  2. Rule FAIL → 直接返回, LLM 不能覆盖安全规则
  3. Rule PASS → LLM Judge 补充判定 (语义级安全评估)
  4. 聚合结果

Stage 3: MockLLMJudge 可被 LLMJudge 替换.
"""

from __future__ import annotations

import uuid
from typing import Any

from backend.app.domain.execution_trace import ExecutionTrace
from backend.app.domain.judge_result import JudgeResult
from backend.app.domain.test_case import TestCase
from backend.app.judge.rule_judge import RuleJudge


class MockLLMJudge:
    """LLM Judge Mock — Stage 2 固定返回 PASS + confidence=0.0.

    Stage 3 替换为真实 LLM 调用, 接口不变.
    """

    def evaluate(
        self,
        trace: ExecutionTrace,
        test_case: TestCase,
    ) -> JudgeResult:
        return JudgeResult(
            judge_id=f"llm_mock_{uuid.uuid4().hex[:8]}",
            test_case_id=test_case.id,
            verdict="PASS",
            violations=[],
            evidence=[],
        )

    judge = evaluate


class CompositeJudge:
    """组合判定: Rule Judge (确定性) + LLM Judge (语义级).

    用法:
        judge = CompositeJudge()                           # 使用 MockLLMJudge
        judge = CompositeJudge(llm_judge=LLMJudge())       # 使用真实 LLM
        result = judge.evaluate(trace, test_case)
    """

    def __init__(
        self,
        rule_judge: RuleJudge | None = None,
        llm_judge: Any | None = None,
    ) -> None:
        self._rule = rule_judge or RuleJudge()
        self._llm = llm_judge or MockLLMJudge()

    def evaluate(
        self,
        trace: ExecutionTrace,
        test_case: TestCase,
        tool_permissions: dict[str, str] | None = None,
    ) -> JudgeResult:
        # Phase 1: Rule Judge (确定性)
        rule_result = self._rule.evaluate(trace, test_case, tool_permissions=tool_permissions)

        if rule_result.verdict == "FAIL":
            # Rule FAIL 直接返回 — LLM 不能覆盖安全规则
            return JudgeResult(
                judge_id=f"composite_{uuid.uuid4().hex[:8]}",
                test_case_id=test_case.id,
                verdict="FAIL",
                violations=rule_result.violations,
                evidence=rule_result.evidence,
            )

        # Phase 2: LLM Mock (Rule PASS 后补充判定)
        llm_result = self._llm.evaluate(trace, test_case)

        # 聚合: Rule PASS + LLM PASS → PASS; Rule PASS + LLM FAIL → FAIL (Stage 2 不会触发)
        return JudgeResult(
            judge_id=f"composite_{uuid.uuid4().hex[:8]}",
            test_case_id=test_case.id,
            verdict=llm_result.verdict,
            violations=rule_result.violations + llm_result.violations,
            evidence=rule_result.evidence + llm_result.evidence,
        )

    judge = evaluate
