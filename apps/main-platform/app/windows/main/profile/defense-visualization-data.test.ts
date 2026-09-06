import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEFENSE_DISPLAY_INDEX,
  DEFAULT_DEFENSE_LAYER_INDEX,
  DEFENSE_DISPLAY_ITEMS,
  DEFENSE_DISPLAY_LAYERS,
  DEFENSE_LAYERS,
  getDefenseCanonicalIndexFromDisplayItemIndex,
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

test("adds the UI-only bridge between displayed D2 and D3", () => {
  assert.equal(DEFAULT_DEFENSE_DISPLAY_INDEX, 0);
  assert.equal(DEFENSE_DISPLAY_ITEMS.length, 9);
  assert.deepEqual(
    DEFENSE_DISPLAY_ITEMS.map((item) =>
      item.kind === "bridge"
        ? [item.kind, item.id, item.label]
        : [item.kind, item.displayId, item.label, item.canonicalId],
    ),
    [
      ["layer", "D1", "输入过滤", "D1"],
      ["layer", "D2", "指令隔离", "D4"],
      ["bridge", "llm-tool-call-bridge", "LLM 推理 → 返回 tool calls"],
      ["layer", "D3", "因果链监测", "D5"],
      ["layer", "D4", "意图分类", "D6"],
      ["layer", "D5", "记忆审计", "D7"],
      ["layer", "D6", "会话监控", "D8"],
      ["layer", "D7", "输出过滤", "D2"],
      ["layer", "D8", "确认门控", "D3"],
    ],
  );
  assert.equal(getDefenseCanonicalIndexFromDisplayItemIndex(2), null);
});

test("maps every display item back to its canonical defense layer", () => {
  for (const [displayIndex, layer] of DEFENSE_DISPLAY_LAYERS.entries()) {
    const canonicalIndex = getDefenseCanonicalIndexFromDisplayIndex(displayIndex);
    assert.equal(getDefenseLayer(canonicalIndex).id, layer.canonicalId);
    assert.equal(getDefenseDisplayIndexFromCanonicalIndex(canonicalIndex), displayIndex);
  }
});

test("maps every ordinary display item through the bridge-aware index safely", () => {
  for (const [displayIndex, item] of DEFENSE_DISPLAY_ITEMS.entries()) {
    const canonicalIndex = getDefenseCanonicalIndexFromDisplayItemIndex(displayIndex);
    if (item.kind === "bridge") {
      assert.equal(canonicalIndex, null);
      continue;
    }
    assert.notEqual(canonicalIndex, null);
    assert.equal(getDefenseLayer(canonicalIndex!).id, item.canonicalId);
  }
});
