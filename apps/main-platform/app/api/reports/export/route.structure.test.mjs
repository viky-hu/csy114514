import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");

test("export route validates all discriminators and formats", () => {
  assert.match(source, /type Kind = "evaluation" \| "comparison" \| "redteam"/);
  assert.match(source, /type Format = "txt" \| "markdown" \| "pdf"/);
  assert.match(source, /INVALID_EXPORT_PARAMETERS/);
  assert.match(source, /Content-Disposition/);
});

test("export route rebuilds data server-side and supports PDF rendering", () => {
  assert.match(source, /buildEvaluationSnapshot/);
  assert.match(source, /buildComparisonSnapshot/);
  assert.match(source, /buildRedTeamSnapshot/);
  assert.match(source, /chromium\.launch/);
  assert.doesNotMatch(source, /request\.json\(\)/);
});

test("export route has an explicit mock fixture boundary", () => {
  assert.match(source, /buildMockReportSnapshot/);
  assert.match(source, /searchParams\.get\("mock"\)/);
  assert.match(source, /id\.startsWith\("mock-"\)/);
});
