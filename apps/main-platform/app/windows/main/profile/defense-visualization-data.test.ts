import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEFENSE_LAYER_INDEX,
  DEFENSE_LAYERS,
  DEFENSE_WHEEL_LAYERS,
  getDefenseCanonicalIndexFromWheelIndex,
  getDefenseLayer,
  getDefenseWheelIndex,
} from "./defense-visualization-data.ts";

test("defines the eight defense layers in canonical ID order", () => {
  assert.deepEqual(
    DEFENSE_LAYERS.map((layer) => [layer.id, layer.label]),
    [
      ["D1", "输入过滤"],
      ["D2", "输出过滤"],
      ["D3", "确认门控"],
      ["D4", "指令隔离"],
      ["D5", "链检测"],
      ["D6", "意图分类"],
      ["D7", "记忆审计"],
      ["D8", "会话监控"],
    ],
  );
});

test("starts the visualizer on D1 and resolves its placeholder state", () => {
  assert.equal(DEFAULT_DEFENSE_LAYER_INDEX, 0);
  assert.deepEqual(getDefenseLayer(DEFAULT_DEFENSE_LAYER_INDEX), {
    id: "D1",
    label: "输入过滤",
  });
});

test("keeps backend IDs canonical while presenting the 4.1 wheel order", () => {
  assert.deepEqual(
    DEFENSE_WHEEL_LAYERS.map((layer) => [layer.id, layer.label]),
    [
      ["D1", "输入过滤"],
      ["D4", "指令隔离"],
      ["D5", "链检测"],
      ["D6", "意图分类"],
      ["D7", "记忆审计"],
      ["D8", "会话监控"],
      ["D2", "输出过滤"],
      ["D3", "确认门控"],
    ],
  );
});

test("maps every wheel item back to its canonical defense layer", () => {
  for (const [wheelIndex, layer] of DEFENSE_WHEEL_LAYERS.entries()) {
    const canonicalIndex = getDefenseCanonicalIndexFromWheelIndex(wheelIndex);
    assert.equal(getDefenseLayer(canonicalIndex).id, layer.id);
    assert.equal(getDefenseWheelIndex(canonicalIndex), wheelIndex);
  }
});
