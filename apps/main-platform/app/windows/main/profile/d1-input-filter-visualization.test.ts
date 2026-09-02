import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  D1_FILTER_INPUT_META,
  D1_FILTER_OUTPUT_META,
  D1_RULES,
  D1_STAGES,
  INPUT_FILTER_SOURCE,
} from "./d1-input-filter-visualization-data.ts";

const backendSource = readFileSync(
  new URL("../../../../../../csy——全智赛/backend/app/agents/defenses/input_filter.py", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

test("D1 source copy matches the backend input filter", () => {
  assert.equal(INPUT_FILTER_SOURCE.replace(/\r\n/g, "\n"), backendSource);
});

test("D1 stages retain real sanitization anchors and markers", () => {
  assert.equal(D1_STAGES.length, 5);
  assert.deepEqual(
    D1_STAGES.map((stage) => stage.type),
    ["zero-width", "nfkc", "base64", "hidden-html", "injection-pattern"],
  );
  for (const stage of D1_STAGES) {
    assert.ok(stage.sourceLine > 0);
    assert.ok(INPUT_FILTER_SOURCE.split(/\r?\n/)[stage.sourceLine - 1]?.includes(stage.anchor));
  }
  assert.ok(D1_STAGES[2]?.output.includes("[REDACTED-BASE64]"));
  assert.ok(D1_STAGES[4]?.output.includes("[REDACTED]"));
});

test("D1 detail data exposes the fixed comparison metadata and rule entries", () => {
  assert.equal(D1_FILTER_INPUT_META.label, "不可信网页 / 邮件内容");
  assert.equal(D1_FILTER_OUTPUT_META.label, "交给模型的安全内容");
  assert.equal(D1_FILTER_INPUT_META.marker, "原始输入");
  assert.equal(D1_FILTER_OUTPUT_META.marker, "清洗输出");
  assert.match(D1_FILTER_INPUT_META.description, /原始|输入/);
  assert.match(D1_FILTER_OUTPUT_META.description, /清理|上下文/);
  assert.equal(D1_RULES.length, 5);
  assert.deepEqual(
    D1_RULES.map((rule) => rule.type),
    ["zero-width", "nfkc", "base64", "hidden-html", "injection-pattern"],
  );
  assert.ok(D1_RULES.some((rule) => rule.label.includes("Unicode")));
  assert.ok(D1_RULES.some((rule) => rule.label.includes("零宽")));
  assert.ok(D1_RULES.some((rule) => rule.label.includes("Base64")));
  assert.ok(D1_RULES.some((rule) => rule.label.includes("HTML")));
  assert.ok(D1_RULES.some((rule) => rule.label.includes("注入")));
});
