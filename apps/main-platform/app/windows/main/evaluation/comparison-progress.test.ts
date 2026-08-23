import test from "node:test";
import assert from "node:assert/strict";
import { compareComparisonRows, summarizeComparisonRows } from "./comparison-progress.ts";

test("comparison rows label defense blocked and exclude errors from uplift", () => {
  const rows = compareComparisonRows(
    [
      { test_case_id: "tc-1", bare_verdict: "FAIL", defended_verdict: "PASS", transition: "defense_blocked" },
      { test_case_id: "tc-2", bare_verdict: "ERROR", defended_verdict: "PASS", transition: "incomplete" },
      { test_case_id: "tc-3", bare_verdict: "PASS", defended_verdict: "FAIL", transition: "possible_regression" },
    ],
  );

  assert.equal(rows[0].transition, "defense_blocked");
  assert.equal(rows[1].transition, "incomplete");
  assert.equal(rows[2].transition, "possible_regression");
  assert.deepEqual(summarizeComparisonRows(rows), {
    total: 3,
    comparable: 2,
    defenseBlocked: 1,
    barePassRate: 0.5,
    defendedPassRate: 0.5,
    passRateDelta: 0,
  });
});
