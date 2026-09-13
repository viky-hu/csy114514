import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createTopologySecurityProfileViewModel,
  createSecurityProfileViewModel,
  type SecurityProfileInput,
} from "./security-profile-data.ts";
import type { AgentTopology } from "../topology/topology-types.ts";

function readFixture<T>(name: string): T {
  const fixtureUrl = new URL(
    `../../../../../../csy——全智赛/shared/fixtures/${name}`,
    import.meta.url,
  );

  return JSON.parse(readFileSync(fixtureUrl, "utf8")) as T;
}

test("creates the security profile graph model from shared fixtures", () => {
  const agentProfile = readFixture<SecurityProfileInput["agentProfile"]>(
    "agent_profile.json",
  );
  const attackGraph = readFixture<SecurityProfileInput["attackGraph"]>(
    "attack_graph.json",
  );

  const viewModel = createSecurityProfileViewModel({
    agentProfile,
    attackGraph,
  });

  assert.equal(viewModel.agent.label, "CorpMate v0");
  assert.equal(viewModel.agent.meta[0].value, "6 项工具");
  assert.deepEqual(
    viewModel.columns.map((column) => [
      column.id,
      column.title,
      column.nodeIds,
    ]),
    [
      ["input-data", "输入/数据边界", ["source-browser", "data-email"]],
      ["agent-core", "Agent执行核心", ["agent-corpmate"]],
      ["persistent-memory", "持久记忆资产", ["memory-persistent"]],
      ["tool-sink", "工具/外发边界", ["tool-email-read", "tool-email-send"]],
    ],
  );
  assert.deepEqual(
    viewModel.sources.map((node) => [node.id, node.columnId, node.labels]),
    [["source-browser", "input-data", ["UNTRUSTED"]]],
  );
  assert.equal(viewModel.nodes.some((node) => node.id === "source-email"), false);
  assert.deepEqual(
    viewModel.tools.map((node) => [node.id, node.columnId, node.permission]),
    [
      ["tool-email-read", "tool-sink", "ALLOW"],
      ["tool-email-send", "tool-sink", "CONFIRM"],
    ],
  );
  assert.deepEqual(
    viewModel.memory.map((node) => [node.id, node.columnId, node.labels]),
    [["memory-persistent", "persistent-memory", ["PERSISTENT"]]],
  );
  assert.deepEqual(
    viewModel.data.map((node) => [node.id, node.columnId, node.labels]),
    [["data-email", "input-data", ["SENSITIVE"]]],
  );
  assert.equal(viewModel.agent.columnId, "agent-core");
  assert.deepEqual(viewModel.permissionCounts, {
    ALLOW: 5,
    CONFIRM: 1,
    DENY: 0,
  });
});

test("does not invent tools or deny permissions missing from fixtures", () => {
  const agentProfile = readFixture<SecurityProfileInput["agentProfile"]>(
    "agent_profile.json",
  );
  const attackGraph = readFixture<SecurityProfileInput["attackGraph"]>(
    "attack_graph.json",
  );

  const viewModel = createSecurityProfileViewModel({
    agentProfile,
    attackGraph,
  });
  const allNodeText = viewModel.nodes
    .flatMap((node) => [node.id, node.label, node.detail])
    .join(" ");

  assert.equal(allNodeText.includes("delete"), false);
  assert.equal(allNodeText.includes("删除"), false);
  assert.equal(viewModel.nodes.some((node) => node.permission === "DENY"), false);
});

test("projects planner and executor into the existing execution boundary with their real task-plan channel", () => {
  const agentProfile = readFixture<SecurityProfileInput["agentProfile"]>(
    "agent_profile.json",
  );
  const attackGraph = readFixture<SecurityProfileInput["attackGraph"]>(
    "attack_graph.json",
  );
  const topology: AgentTopology = {
    agent_id: "corp-mate",
    edges: [
      {
        carries_untrusted_content: true,
        channel: "task_plan",
        from_node: "planner",
        to_node: "executor",
      },
    ],
    nodes: [
      { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
      { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
    ],
    topology_type: "planner_executor",
  };

  const viewModel = createTopologySecurityProfileViewModel(
    createSecurityProfileViewModel({ agentProfile, attackGraph }),
    topology,
  );

  assert.deepEqual(
    viewModel.nodes
      .filter((node) => node.id === "planner" || node.id === "executor")
      .map((node) => [node.id, node.columnId, node.label, node.subtitle]),
    [
      ["planner", "agent-core", "任务规划", "PLANNER · INTERNAL"],
      ["executor", "agent-core", "任务执行", "EXECUTOR · INTERNAL"],
    ],
  );
  assert.deepEqual(viewModel.routes.find((route) => route.id === "topology-planner-executor"), {
    carriesUntrustedContent: true,
    channel: "task_plan",
    description: "不可信内容经 task_plan 从任务规划进入任务执行。",
    id: "topology-planner-executor",
    sourceNodeId: "planner",
    targetNodeId: "executor",
    type: "task_plan",
  });
  assert.equal(viewModel.nodes.some((node) => node.id === "agent-corpmate"), false);
});

test("uses the real external topology entry instead of duplicating the browser context node", () => {
  const agentProfile = readFixture<SecurityProfileInput["agentProfile"]>("agent_profile.json");
  const attackGraph = readFixture<SecurityProfileInput["attackGraph"]>("attack_graph.json");
  const viewModel = createTopologySecurityProfileViewModel(
    createSecurityProfileViewModel({ agentProfile, attackGraph }),
    {
      agent_id: "corpmate-v0",
      topology_type: "planner_executor",
      nodes: [
        { id: "browser", role: "AGENT", tools: ["browser.open_page"], trust_boundary: "external" },
        { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
        { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
      ],
      edges: [
        { from_node: "browser", to_node: "planner", channel: "task_plan", carries_untrusted_content: true },
        { from_node: "planner", to_node: "executor", channel: "task_plan", carries_untrusted_content: false },
      ],
    },
  );

  assert.equal(viewModel.nodes.filter((node) => node.columnId === "input-data" && node.id !== "data-email").length, 1);
  assert.equal(viewModel.nodes.some((node) => node.id === "browser"), true);
  assert.equal(viewModel.nodes.some((node) => node.id === "source-browser"), false);
});

test("merges attack-graph context routes with topology routes instead of replacing them", () => {
  const agentProfile = readFixture<SecurityProfileInput["agentProfile"]>("agent_profile.json");
  const attackGraph = {
    risk_path_ids: ["R5"],
    nodes: [
      { node_id: "n_source_browser", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "browser.open_page", description: "web", role: "external" } },
      { node_id: "planner", node_type: "AGENT", labels: [], metadata: { name: "Planner", description: "plan", role: "planner" } },
      { node_id: "executor", node_type: "AGENT", labels: [], metadata: { name: "Executor", description: "execute", role: "executor" } },
      { node_id: "n_memory_persistent", node_type: "MEMORY", labels: ["PERSISTENT"], metadata: { name: "memory.read / memory.write", description: "memory" } },
      { node_id: "n_tool_email_send", node_type: "TOOL", labels: ["DANGEROUS"], metadata: { name: "email.send", description: "send" } },
    ],
    edges: [
      { edge_id: "web-planner", edge_type: "UNTRUSTED_INPUT", source_node_id: "n_source_browser", target_node_id: "planner", metadata: { description: "web enters planner" } },
      { edge_id: "planner-executor", edge_type: "TASK_PLAN", source_node_id: "planner", target_node_id: "executor", metadata: { description: "plan reaches executor" } },
      { edge_id: "executor-memory", edge_type: "MEMORY_WRITE", source_node_id: "executor", target_node_id: "n_memory_persistent", metadata: { description: "executor writes memory" } },
      { edge_id: "executor-send", edge_type: "TOOL_CALL", source_node_id: "executor", target_node_id: "n_tool_email_send", metadata: { description: "executor calls tool" } },
    ],
  };
  const topology: AgentTopology = {
    agent_id: "corpmate-v0",
    topology_type: "planner_executor",
    nodes: [
      { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
      { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
    ],
    edges: [
      { from_node: "planner", to_node: "executor", channel: "task_plan", carries_untrusted_content: true },
    ],
  };
  const base = createSecurityProfileViewModel({
    agentProfile,
    attackGraph: attackGraph as SecurityProfileInput["attackGraph"],
  });
  const viewModel = createTopologySecurityProfileViewModel(base, topology, attackGraph);

  assert.deepEqual(
    viewModel.routes.map((route) => [route.sourceNodeId, route.targetNodeId]),
    [
      ["source-browser", "planner"],
      ["planner", "executor"],
      ["executor", "memory-persistent"],
      ["executor", "tool-email-send"],
    ],
  );
});
