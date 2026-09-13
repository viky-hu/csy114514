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


test("builds R5 and R6 topology paths from role metadata and preserves potential status", () => {
  const baseProfile = { agent_id: "topology-agent", manifest: { name: "Topology Agent", version: "1", tool_permissions: {} }, security_assets: { dangerous_tools: ["email.send"], persistent_stores: [], sensitive_tools: [], untrusted_sources: [] } } satisfies AnatomyInput["agentProfile"];
  const riskPatterns = [
    { id: "R5", name: "计划污染", description: "plan pollution", risk_type: "R5", severity: "HIGH", attack_goal: "dangerous execution", success_condition: "executor sends email" },
    { id: "R6", name: "RAG 上下文投毒", description: "rag poisoning", risk_type: "R6", severity: "HIGH", attack_goal: "context poisoning", success_condition: "agent sends email" },
  ] satisfies AnatomyInput["riskPatterns"];
  const attackGraph = {
    nodes: [
      { node_id: "browser", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "browser.open_page", role: "browser" } },
      { node_id: "planner", node_type: "AGENT", labels: [], metadata: { name: "Planner", role: "planner" } },
      { node_id: "executor", node_type: "AGENT", labels: [], metadata: { name: "Executor", role: "executor" } },
      { node_id: "external-docs", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "External Documents", role: "external" } },
      { node_id: "knowledge", node_type: "KNOWLEDGE_BASE", labels: [], metadata: { name: "Knowledge Base", role: "knowledge_base" } },
      { node_id: "retriever", node_type: "AGENT", labels: [], metadata: { name: "Retriever", role: "retriever" } },
      { node_id: "agent", node_type: "AGENT", labels: [], metadata: { name: "Topology Agent", role: "agent" } },
      { node_id: "email", node_type: "TOOL", labels: ["DANGEROUS"], metadata: { name: "email.send" } },
    ],
    edges: [],
    risk_path_ids: ["R5", "R6"],
  } satisfies AnatomyInput["attackGraph"];
  const model = createAnatomyViewModel({ agentProfile: baseProfile, attackGraph, attackSeeds: [], mode: "live", riskPatterns, selectedPathId: "R5", testCases: [] });
  assert.deepEqual(model.paths.map((path) => path.id), ["R5", "R6"]);
  assert.deepEqual(model.paths[0]?.steps.map((step) => [step.role, step.label]), [["source", "browser.open_page"], ["planner", "Planner"], ["executor", "Executor"], ["tool", "email.send"]]);
  assert.deepEqual(model.paths[1]?.steps.map((step) => [step.role, step.label]), [["source", "External Documents"], ["knowledge_base", "Knowledge Base"], ["retriever", "Retriever"], ["agent", "Topology Agent"], ["tool", "email.send"]]);
  assert.equal(model.paths[0]?.status, "potential");
  assert.equal(model.paths[0]?.testCaseId, null);
});
