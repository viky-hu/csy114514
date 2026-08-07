import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createSecurityProfileViewModel,
  type SecurityProfileInput,
} from "./security-profile-data.ts";

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
