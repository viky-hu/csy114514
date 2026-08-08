import assert from "node:assert/strict";
import test from "node:test";

import {
  ANATOMY_LAYOUT_BY_NODE_ID,
  ANATOMY_LAYOUT_OFFSET_X,
  ANATOMY_LAYOUT_OFFSET_Y,
  ANATOMY_NODE_LAYOUTS,
  ANATOMY_PHASE_LABEL_Y,
  ANATOMY_PHASE_RAIL_PATH,
  buildAnatomyRouteSegments,
  getActiveAnatomyRouteNodeIds,
  getAnatomyNodeAnchor,
  getAnatomyNodeBounds,
} from "./anatomy-graph-layout.ts";

function getPathNumbers(path: string) {
  return path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
}

test("derives attack graph anchors from centered node boundaries", () => {
  assert.equal(ANATOMY_LAYOUT_OFFSET_X, 48);
  assert.equal(ANATOMY_LAYOUT_OFFSET_Y, 28);
  assert.equal(ANATOMY_PHASE_LABEL_Y, 418);
  assert.equal(ANATOMY_PHASE_RAIL_PATH, "M 104 484 H 886");

  assert.deepEqual(getAnatomyNodeBounds(ANATOMY_NODE_LAYOUTS.sourceBrowser), {
    bottom: 132,
    left: 85,
    right: 235,
    top: 44,
  });

  assert.deepEqual(
    getAnatomyNodeAnchor(ANATOMY_NODE_LAYOUTS.sourceBrowser, "bottom"),
    { x: 160, y: 132 },
  );
  assert.deepEqual(
    getAnatomyNodeAnchor(ANATOMY_NODE_LAYOUTS.agentFirstPass, "left"),
    { x: 259, y: 194 },
  );
});

test("keeps every attack graph node on the same large rectangle size", () => {
  for (const layout of Object.values(ANATOMY_NODE_LAYOUTS)) {
    assert.equal(layout.width, 150, `${layout.id} width`);
    assert.equal(layout.height, 88, `${layout.id} height`);
  }
});

test("builds every attack graph route from source edge center to target edge center", () => {
  const segments = buildAnatomyRouteSegments();

  assert.equal(segments.length, 7);
  for (const segment of segments) {
    const source = getAnatomyNodeAnchor(
      ANATOMY_LAYOUT_BY_NODE_ID[segment.sourceNodeId],
      segment.sourceAnchor,
    );
    const target = getAnatomyNodeAnchor(
      ANATOMY_LAYOUT_BY_NODE_ID[segment.targetNodeId],
      segment.targetAnchor,
    );
    const numbers = getPathNumbers(segment.d);
    const [startX, startY] = numbers;
    const endX = numbers.at(-2);
    const endY = numbers.at(-1);

    assert.deepEqual(
      [startX, startY, endX, endY],
      [source.x, source.y, target.x, target.y],
      `${segment.id} must attach to measured node edge centers`,
    );
  }
});

test("keeps one visible curve per source and target node pair", () => {
  const segments = buildAnatomyRouteSegments();
  const nodePairs = segments.map(
    (segment) => `${segment.sourceNodeId}->${segment.targetNodeId}`,
  );

  assert.deepEqual(new Set(nodePairs).size, nodePairs.length);
  assert.deepEqual(
    segments.find((segment) => segment.id === "agent-first-pass-to-email-send")
      ?.pathIds,
    ["R1", "R3"],
  );
});

test("derives active nodes from every selected route endpoint", () => {
  assert.deepEqual(Array.from(getActiveAnatomyRouteNodeIds("R3")).sort(), [
    "agent-first-pass",
    "data-email",
    "tool-email-read",
    "tool-email-send",
  ]);
});
