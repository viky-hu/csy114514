import assert from "node:assert/strict";
import test from "node:test";

import {
  createLoginLoadingSessionController,
} from "./login-loading-session.ts";

test("loading session rejects stale callbacks and accepts one exit completion", () => {
  const controller = createLoginLoadingSessionController();
  const firstSession = controller.begin();

  assert.equal(controller.isCurrent(firstSession), true);
  assert.equal(controller.activateTip(firstSession, "boot-01"), true);
  assert.equal(controller.markRevealComplete(firstSession, "boot-01"), true);
  assert.equal(controller.acceptExit(firstSession, "boot-01"), true);
  assert.equal(controller.acceptExit(firstSession, "boot-01"), false);

  const secondSession = controller.begin();

  assert.equal(controller.isCurrent(firstSession), false);
  assert.equal(controller.acceptExit(firstSession, "boot-01"), false);
  assert.equal(controller.activateTip(secondSession, "boot-02"), true);
  assert.equal(controller.markRevealComplete(secondSession, "boot-02"), true);
  assert.equal(controller.acceptExit(secondSession, "boot-02"), true);
});

test("loading session can defer the first tip until overlay reveal completes", () => {
  const controller = createLoginLoadingSessionController();
  const sessionId = controller.begin();

  assert.equal(controller.activateTip(sessionId, "boot-01"), true);
  assert.equal(controller.isTipActive(sessionId, "boot-01"), true);
  assert.equal(controller.isExitAccepted(sessionId, "boot-01"), false);

  controller.markRevealComplete(sessionId, "boot-01");

  assert.equal(controller.isRevealComplete(sessionId, "boot-01"), true);
});
