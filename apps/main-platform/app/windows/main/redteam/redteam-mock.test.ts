import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMockRedTeamEvents,
  createMockRedTeamConnection,
  createMockRedTeamReport,
  createMockRedTeamRun,
} from "./redteam-mock.ts";

test("red team mock playback has a deterministic connection, terminal run, ordered events, and report", () => {
  const connection = createMockRedTeamConnection("llm-agent-v0");
  const run = createMockRedTeamRun(connection);
  const events = buildMockRedTeamEvents(run, 1_700_000_000_000);
  const report = createMockRedTeamReport(run);

  assert.equal(connection.connection_id, "mock-redteam-connection-llm-agent-v0");
  assert.equal(run.status, "completed");
  assert.equal(run.report_available, true);
  assert.deepEqual(events.map((event) => event.seq), events.map((_, index) => index + 1));
  assert.ok(events.some((event) => event.type === "TARGET_VERIFIED"));
  assert.ok(events.some((event) => event.type === "ROUND_STARTED"));
  assert.ok(events.some((event) => event.type === "STRATEGIES_SELECTED"));
  assert.equal(events.at(-1)?.type, "RUN_COMPLETED");
  assert.equal(report.run_id, run.run_id);
  assert.equal(report.outcome_summary.confirmed_bypass, 1);
  assert.ok(report.weight_snapshots?.length);
});
