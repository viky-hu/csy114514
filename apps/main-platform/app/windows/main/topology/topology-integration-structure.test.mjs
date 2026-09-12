import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainWindow = new URL("../MainWindow.tsx", import.meta.url);
const overview = new URL("../overview/OverviewDashboard.tsx", import.meta.url);
const agentWorkspace = new URL("../agent/AgentInterfaceWorkspace.tsx", import.meta.url);

async function sourceOf(url) {
  return readFile(url, "utf8");
}

test("MainWindow owns the active topology and passes it to all topology-aware surfaces", async () => {
  const source = await sourceOf(mainWindow);

  assert.match(source, /defaultTopologyRepository/);
  assert.match(source, /loadAgentTopology\(activeAgentId/);
  assert.match(source, /topology=\{topology\}/);
  assert.match(source, /onTopologySaved/);
});

test("agent configuration exposes topology selection and saves it with the manifest", async () => {
  const source = await sourceOf(agentWorkspace);

  assert.match(source, /loadPresets/);
  assert.match(source, /saveAgentTopology/);
  assert.match(source, /拓扑架构/);
  assert.match(source, /planner_executor/);
  assert.match(source, /rag_agent/);
});

test("overview keeps the existing R4 SVG for single topology and uses the shared flow for alternatives", async () => {
  const source = await sourceOf(overview);

  assert.match(source, /topology\?: AgentTopology/);
  assert.match(source, /activeTopology\.topology_type === "single"/);
  assert.match(source, /<TopologyFlow/);
  assert.match(source, /<OverviewR4Graph/);
});
