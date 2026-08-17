import assert from "node:assert/strict";
import test from "node:test";

import { buildRiskPatternRows, buildSummaryRows } from "./report-summary.ts";

test("risk pattern rows always render R1 through R4 in canonical order", () => {
  const rows = buildSummaryRows(
    {
      R3: { total: 2, passed: 1, failed: 1, error: 0 },
      R1: { total: 3, passed: 3, failed: 0, error: 0 },
    },
    ["R1", "R2", "R3", "R4"],
  );

  assert.deepEqual(rows.map((row) => row.key), ["R1", "R2", "R3", "R4"]);
  assert.deepEqual(rows[1], {
    key: "R2",
    total: 0,
    passed: 0,
    failed: 0,
    error: 0,
    passedPercent: 0,
    failedPercent: 0,
    errorPercent: 0,
  });
  assert.equal(rows[2].passedPercent, 50);
  assert.equal(rows[2].failedPercent, 50);
});

test("risk pattern rows retain server categories outside R1-R4", () => {
  const rows = buildRiskPatternRows({ OTHER: { total: 51, failed: 3, error: 1 } });
  assert.deepEqual(rows.map((row) => row.key), ["R1", "R2", "R3", "R4", "OTHER"]);
  assert.equal(rows.at(-1)?.total, 51);
});

test("dimension rows normalize missing counters and sort non-canonical keys", () => {
  const rows = buildSummaryRows({
    prompt_injection: { total: 4, passed: 1, failed: 2 },
    data_exfiltration: { total: 1, error: 1 },
  });

  assert.deepEqual(rows.map((row) => row.key), ["data_exfiltration", "prompt_injection"]);
  assert.deepEqual(rows[0], {
    key: "data_exfiltration",
    total: 1,
    passed: 0,
    failed: 0,
    error: 1,
    passedPercent: 0,
    failedPercent: 0,
    errorPercent: 100,
  });
});
