import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveRedTeamSteps,
  formatRedTeamEvent,
  redTeamEventKind,
} from "./redteam-running.ts";
import { buildMockRedTeamEvents, createMockRedTeamConnection, createMockRedTeamRun } from "./redteam-mock.ts";

test("red-team steps progress in order from replayed backend events", () => {
  const run = createMockRedTeamRun(createMockRedTeamConnection("agent"));
  const events = buildMockRedTeamEvents(run);
  const steps = deriveRedTeamSteps(run, events);
  assert.deepEqual(steps.map((step) => step.state), ["complete", "complete", "complete", "complete"]);
  assert.match(steps[0].summary, /4/);
  assert.match(steps[2].summary, /绕过|拦截/);
});

test("red-team steps mark the first incomplete step as running or error", () => {
  const run = createMockRedTeamRun(createMockRedTeamConnection("agent"));
  const events = buildMockRedTeamEvents(run).slice(0, 3);
  const activeRun = { ...run, status: "running" as const, current_round: 1, report_available: false };
  assert.deepEqual(deriveRedTeamSteps(activeRun, events).map((step) => step.state), ["complete", "running", "waiting", "waiting"]);
  const failedSteps = deriveRedTeamSteps({ ...activeRun, status: "failed", error_message: "适配器失败" }, events);
  assert.equal(failedSteps[1].state, "error");
  assert.equal(failedSteps[1].detail, "适配器失败");
});

test("queued and prematurely completed runs do not bypass event-count gates", () => {
  const run = createMockRedTeamRun(createMockRedTeamConnection("agent"));
  const sparseEvents = buildMockRedTeamEvents(run).slice(0, 3);
  assert.deepEqual(
    deriveRedTeamSteps({ ...run, status: "queued", report_available: false }, sparseEvents).map((step) => step.state),
    ["complete", "waiting", "waiting", "waiting"],
  );
  assert.deepEqual(
    deriveRedTeamSteps(run, sparseEvents).map((step) => step.state),
    ["complete", "waiting", "waiting", "waiting"],
  );
});

test("red-team events have readable Chinese labels and restrained categories", () => {
  const run = createMockRedTeamRun(createMockRedTeamConnection("agent"));
  const event = buildMockRedTeamEvents(run).find((item) => item.type === "VARIANT_EVALUATED")!;
  assert.equal(formatRedTeamEvent(event).label, "变体测评完成");
  assert.equal(redTeamEventKind(event), "agent");
  assert.equal(formatRedTeamEvent(event).detail, "注入策略 · 防御层已拦截");
});
