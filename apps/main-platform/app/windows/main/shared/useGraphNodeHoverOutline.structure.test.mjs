import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./useGraphNodeHoverOutline.ts", import.meta.url), "utf8");

test("shared graph hover resets asynchronous nodes and draws only the active outline", () => {
  assert.match(source, /nodeKey/);
  assert.match(source, /drawSVG:\s*"0% 0%"/);
  assert.match(source, /drawSVG:\s*"0% 100%"/);
  assert.match(source, /activeNodeId/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /duration:\s*reduceMotion\s*\?\s*0\s*:\s*0\.48/);
  assert.match(source, /y:\s*-5/);
  assert.doesNotMatch(source, /\bscale(?:X|Y)?\s*:/);
  assert.doesNotMatch(source, /transformOrigin|svgOrigin/);
});
