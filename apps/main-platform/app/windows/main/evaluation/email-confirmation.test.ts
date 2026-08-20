import assert from "node:assert/strict";
import test from "node:test";

import {
  getEmailConfirmationFromEvent,
  enqueueEmailConfirmation,
  resolveEmailConfirmationQueue,
} from "./email-confirmation.ts";

function event(seq: number, payload: Record<string, unknown>) {
  return {
    seq,
    event_id: `evt-${seq}`,
    run_id: "run-001",
    timestamp: "2026-08-21T00:00:00.000Z",
    type: "TOOL_CALLED",
    payload,
  } as never;
}

test("recognizes only unconfirmed email.send calls and redacts missing recipients", () => {
  assert.equal(
    getEmailConfirmationFromEvent(event(1, {
      tool_name: "email.send",
      confirmed: false,
      arguments: { to: "external@example.com", body: "secret" },
    }) as never)?.recipient,
    "external@example.com",
  );
  assert.equal(getEmailConfirmationFromEvent(event(2, {
    tool_name: "email.send",
    confirmed: false,
    arguments: { body: "secret" },
  }) as never)?.recipient, "未知收件人");
  assert.equal(getEmailConfirmationFromEvent(event(3, {
    tool_name: "email.send",
    confirmed: true,
    arguments: { to: "external@example.com" },
  }) as never), null);
  assert.equal(getEmailConfirmationFromEvent(event(4, {
    tool_name: "memory.write",
    confirmed: false,
  }) as never), null);
});

test("deduplicates replayed events and keeps confirmations in sequence order", () => {
  const first = getEmailConfirmationFromEvent(event(2, { tool_name: "email.send", confirmed: false, arguments: { to: "b@example.com" } }) as never);
  const replay = getEmailConfirmationFromEvent(event(2, { tool_name: "email.send", confirmed: false, arguments: { to: "b@example.com" } }) as never);
  const second = getEmailConfirmationFromEvent(event(3, { tool_name: "email.send", confirmed: false, arguments: { to: "c@example.com" } }) as never);

  const queue = enqueueEmailConfirmation([], first, new Set());
  const replayed = enqueueEmailConfirmation(queue.queue, replay, queue.seenEventIds);
  const appended = enqueueEmailConfirmation(replayed.queue, second, replayed.seenEventIds);

  assert.deepEqual(appended.queue.map((item) => item.eventId), ["evt-2", "evt-3"]);
});

test("resolves the first confirmation without changing later queued items", () => {
  const queue = [
    { eventId: "evt-1", recipient: "a@example.com", decision: null },
    { eventId: "evt-2", recipient: "b@example.com", decision: null },
  ];

  assert.deepEqual(resolveEmailConfirmationQueue(queue, "evt-1", "denied"), [
    { eventId: "evt-2", recipient: "b@example.com", decision: null },
  ]);
});
