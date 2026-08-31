import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefenseWheelItemFrame,
  resolveDefenseWheelLoopTarget,
  resolveDefenseWheelSelection,
  resolveDefenseWheelTarget,
} from "./defense-option-wheel-model.ts";

test("resolves the nearest center option before applying non-looping bounds", () => {
  assert.equal(resolveDefenseWheelSelection(2.49, 8), 2);
  assert.equal(resolveDefenseWheelSelection(2.5, 8), 3);
  assert.equal(resolveDefenseWheelSelection(-0.51, 8), 0);
  assert.equal(resolveDefenseWheelSelection(7.51, 8), 7);
});

test("clamps non-looping wheel movement to the first and last defense layer", () => {
  assert.equal(resolveDefenseWheelTarget(-1.4, 8), 0);
  assert.equal(resolveDefenseWheelTarget(8.2, 8), 7);
  assert.equal(resolveDefenseWheelTarget(3.4, 8), 3.4);
});

test("keeps loop targets on the nearest equivalent cycle", () => {
  assert.equal(resolveDefenseWheelLoopTarget(0, 7, 8), -1);
  assert.equal(resolveDefenseWheelLoopTarget(7, 0, 8), 8);
  assert.equal(resolveDefenseWheelLoopTarget(8.2, 7, 8), 7);
  assert.ok(Math.abs(resolveDefenseWheelLoopTarget(-0.2, 1, 8) - 1) < 1e-9);
});

test("centers the selected option and fades adjacent options along the wheel curve", () => {
  assert.deepEqual(
    getDefenseWheelItemFrame({
      curve: 1,
      fade: 0.25,
      index: 3,
      minOpacity: 0.05,
      position: 3,
      rowHeight: 38,
      side: "left",
      tilt: 6,
    }),
    { blur: 0, opacity: 1, rotation: 0, x: 0, y: 0 },
  );

  const next = getDefenseWheelItemFrame({
    curve: 1,
    fade: 0.25,
    index: 4,
    minOpacity: 0.05,
    position: 3,
    rowHeight: 38,
    side: "left",
    tilt: 6,
  });

  assert.equal(next.opacity, 0.75);
  assert.ok(next.x < 0);
  assert.ok(next.y > 0);
  assert.ok(next.rotation > 0);
});
