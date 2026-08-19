import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("login Agent loading uses Chinese boot tips instead of fixed Loading text", () => {
  const source = read("../login/LoginIntroWindow.tsx");

  assert.match(source, /useLoadingTip\("boot"/);
  assert.doesNotMatch(source, /LOADING_LABEL/);
  assert.match(source, /正在接入 Agent：\$\{loadingTip\}/);
});

test("main Agent interface consumes shared loading tips for read and save states", () => {
  const source = read("../main/agent/AgentInterfaceWorkspace.tsx");

  assert.match(source, /useLoadingTip\("boot"/);
  assert.match(source, /statusTip/);
  assert.doesNotMatch(source, /正在读取当前 Agent 配置/);
  assert.doesNotMatch(source, /正在保存并准备重启主窗口/);
});

test("evaluation run surfaces resolve phases and pass tips into status, process, batch, and terminal states", () => {
  const runSource = read("../main/evaluation/EvaluationRunWorkspace.tsx");
  const batchSource = read("../main/evaluation/BatchProgressPanel.tsx");
  const selectorSource = read("../main/evaluation/TestCaseSelector.tsx");

  assert.match(runSource, /resolveEvaluationLoadingTipPhase/);
  assert.match(runSource, /emptyTip=\{statusTip\}/);
  assert.match(runSource, /R4_TIP_CATEGORIES/);
  assert.match(batchSource, /resolveEvaluationLoadingTipPhase/);
  assert.match(batchSource, /evaluation-batch-tip/);
  assert.match(selectorSource, /useLoadingTip/);
});

test("evaluation report loading and unavailable states use reporting or error tips", () => {
  const source = read("../main/evaluation/EvaluationReportWorkspace.tsx");

  assert.match(source, /resolveEvaluationLoadingTipPhase/);
  assert.match(source, /useLoadingTip/);
  assert.doesNotMatch(source, /正在从持久化证据中装载报告。/);
});
