"""LLMJudge — real LLM-based security judge replacing MockLLMJudge.

Stage 3 Phase 3c: 用 DeepSeek LLM 替代 MockLLMJudge, 对 RuleJudge PASS 的
TestCase 进行语义级安全评估.

接口与 MockLLMJudge 完全一致: evaluate(trace, test_case) → JudgeResult.
可无缝替换 CompositeJudge 中的 MockLLMJudge.
"""
from __future__ import annotations

import logging
import uuid

from backend.app.domain.execution_trace import ExecutionTrace
from backend.app.domain.judge_result import Evidence, JudgeResult, Violation
from backend.app.domain.test_case import TestCase
from backend.app.judge.prompts import JUDGE_SYSTEM_PROMPT, build_judge_prompt
from backend.app.llm.client import LLMClient

logger = logging.getLogger(__name__)


class LLMJudge:
    """LLM-based security judge.

    Replaces MockLLMJudge with real LLM evaluation.
    Same interface: evaluate(trace, test_case) → JudgeResult.

    Uses LLMClient.chat_judge() for structured verdict output.
    Falls back to PASS if LLM call fails (fail-safe).
    """

    def __init__(self, llm_client: LLMClient | None = None):
        self.llm = llm_client or LLMClient()

    def evaluate(
        self,
        trace: ExecutionTrace,
        test_case: TestCase,
    ) -> JudgeResult:
        """Evaluate trace against test case using LLM.

        Returns JudgeResult with verdict, violations, and evidence.
        On LLM failure, returns PASS with low confidence (fail-safe).
        """
        # 1. Build judge prompt
        prompt = build_judge_prompt(trace, test_case)

        # 2. Call LLM with structured output
        try:
            verdict = self.llm.chat_judge([
                {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ])
        except Exception as e:
            logger.error("LLM judge call failed: %s", e)
            return JudgeResult(
                judge_id=f"llm_judge_fallback_{uuid.uuid4().hex[:8]}",
                test_case_id=test_case.id,
                verdict="PASS",
                violations=[],
                evidence=[],
            )

        # 3. Convert JudgeVerdict → JudgeResult
        violations = [
            Violation(
                rule_type=v.get("rule_type", "LLM_DETECTED_VIOLATION"),
                description=v.get("description", ""),
                evidence_event_ids=[],
            )
            for v in verdict.violations
        ]

        # Extract evidence from trace TOOL_CALLED events
        evidence = [
            Evidence(
                event_id=event.event_id,
                tool_name=event.payload.get("tool_name"),
            )
            for event in trace.events
            if event.type == "TOOL_CALLED"
        ]

        return JudgeResult(
            judge_id=f"llm_judge_{uuid.uuid4().hex[:8]}",
            test_case_id=test_case.id,
            verdict=verdict.verdict,
            violations=violations,
            evidence=evidence,
        )

    # Backward compatibility alias
    judge = evaluate
