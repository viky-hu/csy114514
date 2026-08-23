import test from "node:test";
import assert from "node:assert/strict";
import {
  compareComparisonRows,
  reduceComparisonStreamEvent,
  summarizeComparisonRows,
} from "./comparison-progress.ts";
import type { ComparisonStreamEvent } from "./comparison-types.ts";

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

test("comparison stream keeps side-local order and ignores duplicate replay events", () => {
  const first: ComparisonStreamEvent = {
    seq: 1,
    side: "bare",
    run_seq: 2,
    event: {
      event_id: "bare-2",
      run_id: "bare-run",
      timestamp: "2026-08-23T00:00:00.000Z",
      type: "RUN_STARTED",
      payload: {},
    },
  };
  const second: ComparisonStreamEvent = {
    seq: 2,
    side: "defended",
    run_seq: 1,
    event: {
      event_id: "defended-1",
      run_id: "defended-run",
      timestamp: "2026-08-23T00:00:00.100Z",
      type: "RUN_STARTED",
      payload: {},
    },
  };
  const initial = { cursor: 0, events: { bare: [], defended: [] } };
  const afterFirst = reduceComparisonStreamEvent(initial, first);
  const afterSecond = reduceComparisonStreamEvent(afterFirst, second);
  const replay = reduceComparisonStreamEvent(afterSecond, first);

  assert.equal(afterSecond.cursor, 2);
  assert.deepEqual(afterSecond.events.bare.map((event) => event.seq), [2]);
  assert.deepEqual(afterSecond.events.defended.map((event) => event.seq), [1]);
  assert.equal(replay, afterSecond);
});
