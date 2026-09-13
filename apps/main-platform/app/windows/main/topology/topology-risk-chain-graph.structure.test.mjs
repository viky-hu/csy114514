import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("risk-chain graph renders real nodes, visible line bodies, and hover-only outlines", async () => {
  const source = await readFile(new URL("./TopologyRiskChainGraph.tsx", import.meta.url), "utf8");
  assert.match(source, /createTopologyRiskChainLayout/);
  assert.match(source, /data-topology-node-id/);
  assert.match(source, /data-topology-edge-id/);
  assert.match(source, /topology-risk-edge-stroke/);
  assert.match(source, /graph-hover-outline/);
  assert.match(source, /useGraphNodeHoverOutline/);
  assert.doesNotMatch(source, /strokeDasharray/);
});
