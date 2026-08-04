import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createOverviewViewModel,
  type OverviewInput,
} from "./overview-data.ts";

function readFixture<T>(name: string): T {
  const fixtureUrl = new URL(
    `../../../../../../csy——全智赛/shared/fixtures/${name}`,
    import.meta.url,
  );

  return JSON.parse(readFileSync(fixtureUrl, "utf8")) as T;
}

test("creates the R4 overview view model from shared fixtures", () => {
  const agentProfile = readFixture<OverviewInput["agentProfile"]>(
    "agent_profile.json",
  );
  const attackGraph = readFixture<OverviewInput["attackGraph"]>(
    "attack_graph.json",
  );
  const evaluationReport = readFixture<OverviewInput["evaluationReport"]>(
    "evaluation_report.json",
  );

  const viewModel = createOverviewViewModel({
    agentProfile,
    attackGraph,
    evaluationReport,
  });

  assert.equal(viewModel.agent.name, "CorpMate v0");
  assert.equal(viewModel.risk.score, 35);
  assert.equal(viewModel.risk.severity, "CRITICAL");
  assert.equal(viewModel.risk.totalFindings, 2);
  assert.deepEqual(viewModel.risk.severityCounts, {
    CRITICAL: 1,
    HIGH: 1,
    LOW: 0,
    MEDIUM: 0,
  });
  assert.equal(viewModel.r4Finding.riskPatternId, "R4");
  assert.deepEqual(
    viewModel.r4Finding.evidence.map((item) => item.eventId),
    ["evt-003", "evt-007"],
  );
  assert.deepEqual(
    viewModel.attackChain.map((node) => node.label),
    ["browser.open_page", "CorpMate v0", "memory", "CorpMate v0", "email.send"],
  );
  assert.deepEqual(
    viewModel.attackChain.map((node) => node.displayLabel),
    ["网页输入", "Agent解析", "持久记忆", "Agent唤起", "邮件发送"],
  );
  assert.deepEqual(
    viewModel.attackChain.map((node) => node.layer),
    ["source", "agent", "memory", "agent", "tool"],
  );
  assert.deepEqual(
    viewModel.attackChain.map((node) => node.layerLabel),
    ["第一层", "第二层", "第三层", "第二层", "第三层"],
  );
  assert.deepEqual(
    viewModel.attackChain.map((node) => node.stepIndex),
    [0, 1, 2, 3, 4],
  );
  assert.equal(viewModel.agent.confirmedToolName, "email.send");
  assert.equal(viewModel.agent.toolCount, 6);
  assert.deepEqual(viewModel.agent.dataSources, ["browser", "email", "memory"]);
});
