import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyComparisonStreamFailure,
  shouldCloseComparisonStream,
  shouldRestartComparisonStream,
} from "./comparison-sse.ts";

test("terminal comparison snapshots close the stream without a transport error", () => {
  assert.equal(shouldCloseComparisonStream("completed"), true);
  assert.equal(shouldCloseComparisonStream("partial"), true);
  assert.equal(shouldCloseComparisonStream("failed"), true);
  assert.equal(shouldCloseComparisonStream("running_parallel"), false);
});

test("running stream errors wait for reconnect before showing a warning", () => {
  assert.deepEqual(
    classifyComparisonStreamFailure({
      readyState: 0,
      snapshotStatus: "running_parallel",
      snapshotResult: "ok",
      elapsedSinceLastOpenMs: 1_000,
    }),
    "retrying",
  );
  assert.deepEqual(
    classifyComparisonStreamFailure({
      readyState: 0,
      snapshotStatus: "running_parallel",
      snapshotResult: "ok",
      elapsedSinceLastOpenMs: 10_001,
    }),
    "warning",
  );
});

test("terminal and missing snapshots stop automatic reconnects", () => {
  assert.equal(
    classifyComparisonStreamFailure({
      readyState: 0,
      snapshotStatus: "completed",
      snapshotResult: "ok",
      elapsedSinceLastOpenMs: 1_000,
    }),
    "closed",
  );
  assert.equal(
    classifyComparisonStreamFailure({
      readyState: 2,
      snapshotStatus: "running_parallel",
      snapshotResult: "ok",
      elapsedSinceLastOpenMs: 20_000,
    }),
    "fatal",
  );
  assert.equal(
    classifyComparisonStreamFailure({
      readyState: 0,
      snapshotStatus: null,
      snapshotResult: "not_found",
      elapsedSinceLastOpenMs: 20_000,
    }),
    "fatal",
  );
});

test("an unavailable backend remains retryable even when EventSource is closed", () => {
  assert.equal(
    classifyComparisonStreamFailure({
      readyState: 2,
      snapshotStatus: null,
      snapshotResult: "unavailable",
      elapsedSinceLastOpenMs: 1_000,
    }),
    "retrying",
  );
  assert.equal(
    classifyComparisonStreamFailure({
      readyState: 2,
      snapshotStatus: null,
      snapshotResult: "unavailable",
      elapsedSinceLastOpenMs: 20_000,
    }),
    "warning",
  );
});

test("replacing either child run restarts the stream from a fresh aggregate cursor", () => {
  assert.equal(shouldRestartComparisonStream({ bare: "bare-1", defended: "def-1" }, { bare: "bare-1", defended: "def-2" }), true);
  assert.equal(shouldRestartComparisonStream({ bare: "bare-1", defended: "def-1" }, { bare: "bare-1", defended: "def-1" }), false);
});
