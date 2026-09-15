import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./DefenseFlow.tsx", import.meta.url), "utf8");

test("defense flow exposes clickable display-index navigation", () => {
  assert.match(source, /onSelectDisplayIndex/);
  assert.match(source, /role=\"button\"/);
  assert.match(source, /aria-current/);
  assert.match(source, /onClick/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /security-defense-flow-hit-area/);
  assert.match(source, /fill=\"transparent\"/);
});
