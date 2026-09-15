import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoundaryAnchor,
  createSmoothEdgePath,
  createTopologyGraphGeometry,
} from "./topology-graph-geometry.ts";

test("anchors edges on measured rectangle boundary midpoints", () => {
  const source = { id: "source", x: 120, y: 180, width: 140, height: 84 };
  const target = { id: "target", x: 420, y: 180, width: 140, height: 84 };

  assert.deepEqual(createBoundaryAnchor(source, target), { x: 190, y: 180 });
  assert.deepEqual(createBoundaryAnchor(target, source), { x: 350, y: 180 });
});

test("creates a visible smooth path between boundary anchors", () => {
  const source = { id: "source", x: 120, y: 180, width: 140, height: 84 };
  const target = { id: "target", x: 420, y: 260, width: 140, height: 84 };
  const route = createSmoothEdgePath(source, target, 1);

  assert.match(route.d, /^M 190 180 C /);
  assert.match(route.d, /350 260$/);
  assert.ok(route.labelY < 220);
});

test("separates parallel branches deterministically", () => {
  const geometry = createTopologyGraphGeometry(
    [
      { id: "planner", x: 180, y: 200, width: 140, height: 84 },
      { id: "executor", x: 520, y: 160, width: 140, height: 84 },
      { id: "audit", x: 520, y: 300, width: 140, height: 84 },
    ],
    [
      { id: "primary", sourceNodeId: "planner", targetNodeId: "executor", label: "task_plan" },
      { id: "branch", sourceNodeId: "planner", targetNodeId: "audit", label: "audit" },
    ],
  );

  assert.equal(geometry.edges.length, 2);
  assert.notEqual(geometry.edges[0]?.labelY, geometry.edges[1]?.labelY);
  assert.match(geometry.edges[0]?.d ?? "", /^M /);
});
