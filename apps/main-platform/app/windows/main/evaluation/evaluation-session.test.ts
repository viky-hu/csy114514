import assert from "node:assert/strict";
import test from "node:test";

import {
  clearEvaluationWorkspaceSession,
  readStoredEvaluationRunId,
  storeEvaluationRunId,
} from "./evaluation-session.ts";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("evaluation session helpers persist and clear the active run id", () => {
  const storage = new MemoryStorage();

  storeEvaluationRunId("run-001", storage);
  assert.equal(readStoredEvaluationRunId(storage), "run-001");

  clearEvaluationWorkspaceSession(storage);
  assert.equal(readStoredEvaluationRunId(storage), null);
});

test("evaluation session helpers reject invalid run ids", () => {
  const storage = new MemoryStorage();

  storeEvaluationRunId("../bad", storage);

  assert.equal(readStoredEvaluationRunId(storage), null);
});
