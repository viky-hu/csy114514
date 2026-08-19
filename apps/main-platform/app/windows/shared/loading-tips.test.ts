import assert from "node:assert/strict";
import test from "node:test";

import {
  getLoadingTips,
  pickTip,
  resolveEvaluationLoadingTipPhase,
} from "./loading-tips.ts";

test("timeline mode walks boot tips in document order and resets after exhaustion", () => {
  const seen = new Set<string>();

  const first = pickTip("boot", seen, "timeline");
  const second = pickTip("boot", seen, "timeline");

  assert.equal(first.text, "正在校准安全评测引擎…");
  assert.equal(second.text, "正在加载攻击图谱节点…");

  for (const tip of getLoadingTips("boot")) {
    seen.add(tip.id);
  }
  const reset = pickTip("boot", seen, "timeline");
  assert.equal(reset.text, "正在校准安全评测引擎…");
});

test("live mode prefers non-knowledge boot tips when available", () => {
  const tip = pickTip("boot", new Set<string>(), "live", () => 0);

  assert.equal(tip.category !== "knowledge", true);
  assert.equal(tip.phase, "boot");
});

test("evaluation loading phase resolver maps workspace states to the intended phase", () => {
  assert.equal(
    resolveEvaluationLoadingTipPhase({
      isBootstrapping: true,
      isLoadingTestCases: true,
      runStatus: undefined,
    }),
    "boot",
  );
  assert.equal(
    resolveEvaluationLoadingTipPhase({
      runStatus: "preflighting",
      activeStage: "web_content_injection",
    }),
    "preflight",
  );
  assert.equal(
    resolveEvaluationLoadingTipPhase({
      runStatus: "running",
      activeStage: "persistent_memory_poisoning",
    }),
    "running",
  );
  assert.equal(
    resolveEvaluationLoadingTipPhase({
      runStatus: "running",
      latestEventType: "JUDGE_DECISION",
    }),
    "judging",
  );
  assert.equal(
    resolveEvaluationLoadingTipPhase({
      runStatus: "completed",
      hasReport: false,
      isLoadingReport: true,
    }),
    "reporting",
  );
  assert.equal(
    resolveEvaluationLoadingTipPhase({
      testCaseError: "TestCase 列表读取失败",
    }),
    "error",
  );
  assert.equal(resolveEvaluationLoadingTipPhase({}), "idle");
});
