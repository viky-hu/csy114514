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
  assert.deepEqual(getTopologyStepPhaseXs(4), [160, 334, 674, 832]);
  assert.deepEqual(getTopologyStepPhaseXs(5), [160, 334, 504, 674, 832]);
  assert.deepEqual(getTopologyStepPhaseXs(3), [160, 334, 504]);
  assert.deepEqual(getTopologyStepPhaseXs(0), []);
});

test("keeps topology chain nodes at the anatomy node size on the shared rail", () => {
  assert.deepEqual(createTopologyChainNodeLayout(160), {
    height: 88,
    width: 150,
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

    assert.deepEqual(bounds, { bottom: 238, left: x - 75, right: x + 75, top: 150 });
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

    assert.equal(numbers.length, 8);
    assert.deepEqual(
      [numbers[0], numbers[1], numbers[6], numbers[7]],
      [layouts[index].x + 75, 194, layouts[index + 1].x - 75, 194],
      `segment ${index} must attach to node edge centers on the shared rail`,
    );
    assert.deepEqual([numbers[3], numbers[5]], [194, 194]);
    assert.equal(segment.labelX, (layouts[index].x + layouts[index + 1].x) / 2);
    // Channel labels ride above the 150x88 node band so node surfaces never
    // paint over them.
    assert.equal(segment.labelY, 132);
    assert.ok(segment.labelY < 150);
  });
});

test("keeps topology chain segments non-inverted even on the narrow 8px column gap", () => {
  const layouts = getTopologyStepPhaseXs(4).map(createTopologyChainNodeLayout);
  const segments = buildTopologyChainSegments(layouts);
  const last = segments.at(-1);
  const numbers = getPathNumbers(last?.d ?? "");

  // Columns 4 and 5 are 158 apart while nodes are 150 wide: the route must stay
  // a short forward stroke instead of collapsing or crossing backwards.
  assert.deepEqual(
    [numbers[0], numbers[6]],
    [layouts[2].x + 75, layouts[3].x - 75],
  );
  assert.ok(numbers[6] > numbers[0]);
  assert.ok(segments[1].labelX > segments[0].labelX);
});
