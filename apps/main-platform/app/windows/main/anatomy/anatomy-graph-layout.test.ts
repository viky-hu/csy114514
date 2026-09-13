import assert from "node:assert/strict";
import test from "node:test";

import {
  ANATOMY_LAYOUT_BY_NODE_ID,
  ANATOMY_LAYOUT_OFFSET_X,
  ANATOMY_LAYOUT_OFFSET_Y,
  ANATOMY_NODE_LAYOUTS,
  ANATOMY_PHASE_LABEL_Y,
  ANATOMY_PHASE_RAIL_PATH,
  ANATOMY_TOPOLOGY_PHASES,
  buildAnatomyRouteSegments,
  buildTopologyChainSegments,
  createTopologyStageItems,
  createTopologyChainNodeLayout,
  getActiveAnatomyRouteNodeIds,
  getAnatomyNodeAnchor,
  getAnatomyNodeBounds,
  getTopologyStepPhaseXs,
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

test("maps topology chains onto the five anatomy phase columns", () => {
  assert.deepEqual(
    ANATOMY_TOPOLOGY_PHASES.map((phase) => phase.id),
    ["entry", "process", "handoff", "exec", "sink"],
  );
  assert.deepEqual(
    ANATOMY_TOPOLOGY_PHASES.map((phase) => phase.x),
    [160, 334, 504, 674, 832],
  );
  assert.deepEqual(getTopologyStepPhaseXs(4), [160, 334, 504, 674]);
  assert.deepEqual(getTopologyStepPhaseXs(5), [160, 334, 504, 674, 832]);
  assert.deepEqual(getTopologyStepPhaseXs(3), [160, 334, 504]);
  assert.deepEqual(getTopologyStepPhaseXs(0), []);
});

test("inserts a semantic R5 task-plan placeholder and leaves R6 fully real", () => {
  assert.deepEqual(createTopologyStageItems("R5", ["web", "planner", "executor", "send"]), [
    { kind: "node", nodeId: "web" },
    { kind: "node", nodeId: "planner" },
    { caption: "计划交接", kind: "placeholder", label: "TASK PLAN" },
    { kind: "node", nodeId: "executor" },
    { kind: "node", nodeId: "send" },
  ]);
  assert.deepEqual(
    createTopologyStageItems("R6", ["docs", "kb", "retriever", "agent", "send"]).map((item) => item.kind),
    ["node", "node", "node", "node", "node"],
  );
});

test("keeps topology chain nodes compact enough to expose every connector on the shared rail", () => {
  assert.deepEqual(createTopologyChainNodeLayout(160), {
    height: 88,
    width: 128,
    x: 160,
    y: 194,
  });

  for (const x of getTopologyStepPhaseXs(5)) {
    const layout = createTopologyChainNodeLayout(x);
    const bounds = {
      bottom: layout.y + layout.height / 2,
      left: layout.x - layout.width / 2,
      right: layout.x + layout.width / 2,
      top: layout.y - layout.height / 2,
    };

    assert.deepEqual(bounds, { bottom: 238, left: x - 64, right: x + 64, top: 150 });
    // The five-phase rail stays below the node band, exactly like the R1-R4 graph.
    assert.ok(bounds.bottom < ANATOMY_PHASE_LABEL_Y);
  }
});

test("joins topology chain nodes from edge center to edge center", () => {
  const layouts = getTopologyStepPhaseXs(5).map(createTopologyChainNodeLayout);
  const segments = buildTopologyChainSegments(layouts);

  assert.equal(segments.length, 4);

  segments.forEach((segment, index) => {
    const numbers = getPathNumbers(segment.d);

    assert.equal(numbers.length, 4);
    assert.deepEqual(
      numbers,
      [layouts[index].x + 64, 194, layouts[index + 1].x - 64, 194],
      `segment ${index} must attach to node edge centers on the shared rail`,
    );
    assert.equal(segment.labelX, (layouts[index].x + layouts[index + 1].x) / 2);
    // Channel labels ride above the 128x88 node band so node surfaces never
    // paint over them.
    assert.equal(segment.labelY, 132);
    assert.ok(segment.labelY < 150);
  });
});

test("keeps every topology line body visible between measured node boundaries", () => {
  const layouts = getTopologyStepPhaseXs(5).map(createTopologyChainNodeLayout);
  const segments = buildTopologyChainSegments(layouts);
  const last = segments.at(-1);
  const numbers = getPathNumbers(last?.d ?? "");

  // The tightest columns are 158 apart. Compact topology nodes preserve a
  // visible line body while keeping the five stages on one row.
  assert.deepEqual(
    [numbers[0], numbers[2]],
    [layouts[3].x + 64, layouts[4].x - 64],
  );
  assert.ok(numbers[2] - numbers[0] >= 30);
  assert.ok(segments[1].labelX > segments[0].labelX);
});
