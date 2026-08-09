import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createAnatomyViewModel,
  type AnatomyInput,
} from "./anatomy-data.ts";

function readFixture<T>(name: string): T {
  const fixtureUrl = new URL(
    `../../../../../../csy——全智赛/shared/fixtures/${name}`,
    import.meta.url,
  );

  return JSON.parse(readFileSync(fixtureUrl, "utf8")) as T;
}

function readExample<T>(name: string): T {
  const exampleUrl = new URL(
    `../../../../../../csy——全智赛/shared/examples/security/${name}`,
    import.meta.url,
  );

  return JSON.parse(readFileSync(exampleUrl, "utf8")) as T;
}

test("creates the anatomy preview model with R4 selected and verified status from the report", () => {
  const agentProfile = readFixture<AnatomyInput["agentProfile"]>("agent_profile.json");
  const attackGraph = readFixture<AnatomyInput["attackGraph"]>("attack_graph.json");
  const evaluationReport = readFixture<AnatomyInput["evaluationReport"]>(
    "evaluation_report.json",
  );
  const riskPatterns = readExample<AnatomyInput["riskPatterns"]>("risk_patterns.json");
  const testCases = readExample<AnatomyInput["testCases"]>("security_testcases.json");
  const attackSeeds = readExample<AnatomyInput["attackSeeds"]>("attack_seeds.json");

  const viewModel = createAnatomyViewModel({
    agentProfile,
    attackGraph,
    attackSeeds,
    evaluationReport,
    mode: "preview",
    riskPatterns,
    selectedPathId: "R4",
    testCases,
  });

  assert.equal(viewModel.mode, "preview");
  assert.equal(viewModel.bannerLabel, "示例预览");
  assert.equal(viewModel.selectedPathId, "R4");
  assert.equal(viewModel.selectedPath?.id, "R4");
  assert.equal(viewModel.selectedPath?.status, "verified");
  assert.equal(viewModel.selectedPath?.testCaseId, "tc_pipi_001");
  assert.equal(viewModel.selectedPath?.verification.testCaseId, "tc_pipi_001");
  assert.equal(viewModel.selectedPath?.verification.seedIds[0], "seed_pipi_001");
  assert.match(
    viewModel.selectedPath?.verification.howToVerify ?? "",
    /trace\/report/i,
  );
  assert.equal(viewModel.selectedPath?.story, "恶意网页写入长期记忆，之后在邮件任务中被再次唤起。");
  assert.deepEqual(
    viewModel.paths.map((path) => [path.id, path.status]),
    [
      ["R4", "verified"],
      ["R1", "potential"],
      ["R2", "potential"],
      ["R3", "potential"],
    ],
  );
  assert.deepEqual(viewModel.statusCounts, {
    potential: 3,
    verified: 1,
  });
  assert.deepEqual(
    viewModel.selectedPath?.steps.map((step) => [step.stage, step.label]),
    [
      ["ingress", "browser.open_page"],
      ["first_pass", "CorpMate v0"],
      ["persistence", "memory.read / memory.write"],
      ["recall", "CorpMate v0"],
      ["sink", "email.send"],
    ],
  );
  assert.deepEqual(
    viewModel.selectedPath?.steps.map((step) => step.stageLabel),
    ["入口", "初次解析", "持久化", "二次唤起", "外发动作"],
  );
  assert.ok(viewModel.selectedPath?.evidence.some((item) => item.eventId === "evt-003"));
  assert.ok(viewModel.selectedPath?.evidence.some((item) => item.eventId === "evt-007"));
});

test("creates stable verification targets for the main attack patterns", () => {
  const agentProfile = readFixture<AnatomyInput["agentProfile"]>("agent_profile.json");
  const attackGraph = readFixture<AnatomyInput["attackGraph"]>("attack_graph.json");
  const riskPatterns = readExample<AnatomyInput["riskPatterns"]>("risk_patterns.json");
  const testCases = readExample<AnatomyInput["testCases"]>("security_testcases.json");
  const attackSeeds = readExample<AnatomyInput["attackSeeds"]>("attack_seeds.json");

  const viewModel = createAnatomyViewModel({
    agentProfile,
    attackGraph,
    attackSeeds,
    mode: "preview",
    riskPatterns,
    selectedPathId: "R1",
    testCases,
  });

  assert.equal(viewModel.paths.find((path) => path.id === "R1")?.testCaseId, "tc_ipi_001");
  assert.equal(viewModel.paths.find((path) => path.id === "R3")?.testCaseId, "tc_priv_001");
  assert.equal(viewModel.paths.find((path) => path.id === "R2")?.testCaseId, null);
  assert.equal(viewModel.paths.find((path) => path.id === "R4")?.testCaseId, "tc_pipi_001");
  assert.equal(viewModel.canVerifySelectedPath, true);
});

test("treats graph risk_path_ids as potential until a report finding verifies them", () => {
  const agentProfile = readFixture<AnatomyInput["agentProfile"]>("agent_profile.json");
  const attackGraph = readFixture<AnatomyInput["attackGraph"]>("attack_graph.json");
  const riskPatterns = readExample<AnatomyInput["riskPatterns"]>("risk_patterns.json");
  const testCases = readExample<AnatomyInput["testCases"]>("security_testcases.json");
  const attackSeeds = readExample<AnatomyInput["attackSeeds"]>("attack_seeds.json");

  const viewModel = createAnatomyViewModel({
    agentProfile,
    attackGraph,
    attackSeeds,
    evaluationReport: null,
    mode: "live",
    riskPatterns,
    selectedPathId: "R4",
    testCases,
  });

  assert.equal(viewModel.bannerLabel, "真实接入");
  assert.equal(viewModel.selectedPath?.status, "potential");
  assert.deepEqual(viewModel.statusCounts, {
    potential: 4,
    verified: 0,
  });
  assert.equal(viewModel.selectedPath?.evidence.length, 0);
});
