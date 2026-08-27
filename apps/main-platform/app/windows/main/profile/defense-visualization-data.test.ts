import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEFENSE_LAYER_INDEX,
  DEFENSE_LAYERS,
  getDefenseLayer,
} from "./defense-visualization-data.ts";

test("defines the eight selectable defense layers in pipeline order", () => {
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
