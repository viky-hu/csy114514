import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const hookPath = new URL("./useFrozenGraphInlineSize.ts", import.meta.url);

test("frozen graph hook records only a stable expanded canvas and derives a collapsed layout", () => {
  assert.equal(existsSync(hookPath), true);

  if (!existsSync(hookPath)) {
    return;
  }

  const source = readFileSync(hookPath, "utf8");

  assert.match(source, /export function useFrozenGraphInlineSize/);
  assert.match(source, /useLayoutEffect/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /isGraphFrozen: boolean;/);
  assert.match(source, /if \(isGraphFrozen\) \{\s*return;/);
  assert.match(source, /\}, \[graphRef, isGraphFrozen\]\);/);
  assert.doesNotMatch(source, /isSidebarCollapsed/);
  assert.match(source, /--sidebar-frozen-graph-inline-size/);
  assert.match(source, /"split" \| "stacked"/);
});
