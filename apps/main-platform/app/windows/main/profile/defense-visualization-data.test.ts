import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEFENSE_LAYER_INDEX,
  DEFENSE_DISPLAY_LAYERS,
  DEFENSE_LAYERS,
  getDefenseCanonicalIndexFromDisplayIndex,
  getDefenseDisplayIndexFromCanonicalIndex,
  getDefenseLayer,
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

test("keeps backend IDs canonical while presenting the fixed display order", () => {
  assert.deepEqual(
    DEFENSE_DISPLAY_LAYERS.map((layer) => [layer.displayId, layer.label, layer.canonicalId]),
    [
      ["D1", "输入过滤", "D1"],
      ["D2", "指令隔离", "D4"],
      ["D3", "因果链监测", "D5"],
      ["D4", "意图分类", "D6"],
      ["D5", "记忆审计", "D7"],
      ["D6", "会话监控", "D8"],
      ["D7", "输出过滤", "D2"],
      ["D8", "确认门控", "D3"],
    ],
  );
});

test("maps every display item back to its canonical defense layer", () => {
  for (const [displayIndex, layer] of DEFENSE_DISPLAY_LAYERS.entries()) {
    const canonicalIndex = getDefenseCanonicalIndexFromDisplayIndex(displayIndex);
    assert.equal(getDefenseLayer(canonicalIndex).id, layer.canonicalId);
    assert.equal(getDefenseDisplayIndexFromCanonicalIndex(canonicalIndex), displayIndex);
  }
});
