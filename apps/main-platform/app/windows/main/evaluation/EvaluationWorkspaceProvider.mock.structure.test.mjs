import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("./", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("mock mode is wired from the page entry to the evaluation provider", async () => {
  const [page, mainWindow, provider] = await Promise.all([
    read("../../../page.tsx"),
    read("../MainWindow.tsx"),
    read("./EvaluationWorkspaceProvider.tsx"),
  ]);

  assert.match(page, /isEvaluationMockEnabled|evaluationMock/);
  assert.match(page, /mockMode/);
  assert.match(mainWindow, /mockMode\??: boolean/);
  assert.match(mainWindow, /<EvaluationWorkspaceProvider[\s\S]*mockMode=\{mockMode\}/);
  assert.match(provider, /mockMode\??: boolean/);
  assert.match(provider, /mockMode/);
  assert.match(provider, /EventSource/);
  assert.match(provider, /shouldCloseComparisonStream/);
  assert.match(provider, /classifyComparisonStreamFailure/);
  assert.match(provider, /comparison\.bare_run_id/);
  assert.match(provider, /comparison\.defended_run_id/);
});

test("mock mode keeps real session storage and event stream out of its branch", async () => {
  const provider = await read("./EvaluationWorkspaceProvider.tsx");

  assert.match(provider, /if \(mockMode\)/);
  assert.match(provider, /storeEvaluationRunId/);
  assert.match(provider, /clearEvaluationWorkspaceSession/);
  assert.match(provider, /resetEvaluationSelection[\s\S]*?clearMockTimers/);
  assert.match(provider, /mock.*timer|timer.*mock/i);
});

test("comparison mock waits for explicit start and interleaves both child runs", async () => {
  const provider = await read("./EvaluationWorkspaceProvider.tsx");

  assert.match(provider, /status: "queued"/);
  assert.match(provider, /startMockComparison/);
  assert.match(provider, /bare: buildMockEventSequence/);
  assert.match(provider, /defended: buildMockEventSequence/);
  assert.match(provider, /side === "defended" \? 115 : 0/);
  assert.match(provider, /comparisonStatus === "completed"[\s\S]*buildMockComparisonReport/);
});
