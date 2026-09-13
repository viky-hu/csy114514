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
  // Entering the platform must start at Single Agent; the saved mode is only
  // applied after an explicit switch, never auto-loaded on mount.
  assert.doesNotMatch(source, /loadAgentTopology\(activeAgentId/);
  assert.match(source, /createFallbackTopology\(initialAgentId\)/);
  assert.match(source, /isRestartCover/);
  assert.match(source, /setTopology\(nextTopology\)/);
  assert.match(source, /topology=\{topology\}/);
  assert.match(source, /TopologyModeNav/);
  assert.match(source, /const topologyModeNav = root\.querySelector<HTMLElement>\("\.topology-mode-nav"\);/);
  assert.match(source, /gsap\.set\(topologyModeNav, \{ autoAlpha: 0, y: -6 \}\)/);
  assert.match(source, /\.to\(\s*topologyModeNav,\s*\{\s*autoAlpha: 1,\s*duration: 0\.42,\s*ease: "power2\.out",\s*y: 0,?\s*\},\s*0\.92,?\s*\)/s);
});

test("agent configuration restores the original manifest-only workspace while MainWindow owns mode switching", async () => {
  const source = await sourceOf(agentWorkspace);
  const mainSource = await sourceOf(mainWindow);

  assert.doesNotMatch(source, /agent-interface-topology/);
  assert.doesNotMatch(source, /loadPresets/);
  assert.doesNotMatch(source, /saveAgentTopology/);
  assert.match(source, /onDraftSnapshotChange/);
  assert.match(mainSource, /TopologyModeNav/);
  assert.match(mainSource, /onRequestChange/);
  assert.match(mainSource, /saveAgentTopology/);
});

test("overview keeps the existing R4 SVG for single topology and summarizes alternatives", async () => {
  const source = await sourceOf(overview);

  assert.match(source, /topology\?: AgentTopology/);
  assert.match(source, /activeTopology\.topology_type === "single"/);
  assert.doesNotMatch(source, /TopologyFlow/);
  assert.match(source, /topology-summary/);
  assert.match(source, /<OverviewR4Graph/);
});
