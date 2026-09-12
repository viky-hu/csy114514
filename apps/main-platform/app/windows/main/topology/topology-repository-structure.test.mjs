import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repositoryModule = new URL("./topology-repository.ts", import.meta.url);
const typesModule = new URL("./topology-types.ts", import.meta.url);

async function sourceOf(moduleUrl) {
  await access(moduleUrl);
  return readFile(moduleUrl, "utf8");
}

test("topology repository keeps API access, validation, and local fallback in one boundary", async () => {
  const source = await sourceOf(repositoryModule);

  assert.match(source, /export interface TopologyRepository/);
  assert.match(source, /export class ApiTopologyRepository/);
  assert.match(source, /export class MockTopologyRepository/);
  assert.match(source, /\/api\/topology\/presets/);
  assert.match(source, /\/api\/topology\/\$\{encodeURIComponent\(agentId\)\}/);
  assert.match(source, /Invalid topology payload/);
  assert.match(source, /defaultTopologyRepository/);
});

test("topology types distinguish persisted graph data from selectable presets", async () => {
  const source = await sourceOf(typesModule);

  assert.match(source, /export type AgentTopology/);
  assert.match(source, /export type TopologyPreset/);
  assert.match(source, /export type TopologyType/);
  assert.match(source, /"single"/);
  assert.match(source, /"planner_executor"/);
  assert.match(source, /"rag_agent"/);
});
