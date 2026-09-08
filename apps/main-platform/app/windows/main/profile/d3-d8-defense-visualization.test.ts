import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CHAIN_DETECTOR_SOURCE,
  COMPOSITE_SANDBOX_SOURCE,
  CONFIRMATION_SOURCE,
  D3_CHAIN_RULES,
  D3_D8_PANELS,
  D4_RULES,
  D5_RULES,
  D6_RULES,
  D7_RULES,
  D8_RULES,
  INTENT_CLASSIFIER_SOURCE,
  MEMORY_AUDITOR_SOURCE,
  OUTPUT_FILTER_SOURCE,
  SESSION_MONITOR_SOURCE,
} from "./d3-d8-defense-visualization-data.ts";

const backendRoot = new URL("../../../../../../csy——全智赛/backend/app/", import.meta.url);
const readBackend = (fileName: string) => readFileSync(new URL(fileName, backendRoot), "utf8");
const sources = [
  CHAIN_DETECTOR_SOURCE,
  INTENT_CLASSIFIER_SOURCE,
  MEMORY_AUDITOR_SOURCE,
  SESSION_MONITOR_SOURCE,
  OUTPUT_FILTER_SOURCE,
  CONFIRMATION_SOURCE,
  COMPOSITE_SANDBOX_SOURCE,
];
const sourceByFile = new Map(sources.map((source) => [source.fileName, source]));
const ruleSets = [D3_CHAIN_RULES, D4_RULES, D5_RULES, D6_RULES, D7_RULES, D8_RULES];

const backendPathByFile = new Map([
  ["chain_detector.py", "agents/defenses/chain_detector.py"],
  ["intent_classifier.py", "agents/defenses/intent_classifier.py"],
  ["memory_auditor.py", "agents/defenses/memory_auditor.py"],
  ["session_monitor.py", "agents/defenses/session_monitor.py"],
  ["output_filter.py", "agents/defenses/output_filter.py"],
  ["confirmation/__init__.py", "confirmation/__init__.py"],
  ["sandbox/composite.py", "sandbox/composite.py"],
]);

test("maps displayed D3-D8 panels to the real backend canonical defenses", () => {
  assert.deepEqual(
    D3_D8_PANELS.map((panel) => [panel.displayId, panel.canonicalId, panel.sourceFile]),
    [
      ["D3", "D5", "chain_detector.py"],
      ["D4", "D6", "intent_classifier.py"],
      ["D5", "D7", "memory_auditor.py"],
      ["D6", "D8", "session_monitor.py"],
      ["D7", "D2", "output_filter.py"],
      ["D8", "D3", "confirmation/__init__.py"],
    ],
  );
});

test("every rule uses an explicit visual and source mapping", () => {
  for (const rules of ruleSets) {
    const ids = new Set<string>();
    for (const rule of rules) {
      assert.ok(rule.id);
      assert.ok(rule.visualStateId);
      assert.ok(rule.sourceFile);
      assert.ok(rule.sourceLine > 0);
      assert.ok(rule.sourceAnchor);
      assert.ok(!ids.has(rule.id), `duplicate rule id: ${rule.id}`);
      ids.add(rule.id);

      const source = sourceByFile.get(rule.sourceFile);
      assert.ok(source, `missing source snapshot for ${rule.sourceFile}`);
      const sourceLine = source.source.split("\n")[rule.sourceLine - 1] ?? "";
      assert.match(sourceLine, new RegExp(rule.sourceAnchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

      const backendPath = backendPathByFile.get(rule.sourceFile);
      assert.ok(backendPath, `missing backend path for ${rule.sourceFile}`);
      assert.ok(readBackend(backendPath).includes(rule.sourceAnchor));
    }
  }
});

test("D3 exposes six real chain rules and renders one connector per adjacent history node", () => {
  assert.equal(D3_CHAIN_RULES.length, 6);
  assert.deepEqual(D3_CHAIN_RULES.map((rule) => rule.backendLabel), [
    "D5:browse_write_send_chain",
    "D5:browse_send_chain",
    "D5:browse_write_chain",
    "D5:read_send_chain",
    "D5:read_write_send_chain",
    "D5:write_list_send_chain",
  ]);
  for (const rule of D3_CHAIN_RULES) {
    assert.equal(rule.connectionCount, rule.exampleHistory.length - 1);
    assert.equal(rule.maxNoiseBetween, 3);
  }
  assert.deepEqual(D3_CHAIN_RULES[0]?.exampleHistory, [
    "browser.open_page",
    "memory.read",
    "email.list",
    "memory.write",
    "email.send",
  ]);
});

test("D4 has five explicit heuristic states including both thresholds and the default path", () => {
  assert.equal(D4_RULES.length, 5);
  assert.deepEqual(D4_RULES.map((rule) => rule.visualStateId), [
    "user-evidence",
    "page-evidence",
    "page-threshold",
    "user-threshold",
    "non-sensitive-default",
  ]);
  assert.equal(D4_RULES.find((rule) => rule.visualStateId === "page-threshold")?.threshold, 0.6);
  assert.equal(D4_RULES.find((rule) => rule.visualStateId === "user-threshold")?.threshold, 0.7);
  assert.equal(D4_RULES.find((rule) => rule.visualStateId === "non-sensitive-default")?.confidence, 1);
});

test("D5 maps every audit step directly to a source line", () => {
  assert.deepEqual(D5_RULES.map((rule) => rule.visualStateId), [
    "combine-fields",
    "pattern-scan",
    "high-risk-key",
    "secondary-check",
    "blocked",
    "allowed",
  ]);
});

test("D6 includes persisted state, no-read, cross-session, and both same-session branches", () => {
  assert.ok(D6_RULES.some((rule) => rule.backendLabel === "D8:cross_session_memory_poisoning"));
  assert.ok(D6_RULES.some((rule) => rule.backendLabel === "D8:suspicious_cross_session_email"));
  assert.ok(D6_RULES.some((rule) => rule.backendLabel === "D8:same_session_memory_poisoning"));
  assert.ok(D6_RULES.some((rule) => rule.backendLabel === "D8:same_session_suspicious_write_read"));
  assert.ok(D6_RULES.some((rule) => rule.visualStateId === "no-read"));
});

test("D7 exposes six blocking checks plus a real allow path in backend order", () => {
  assert.equal(D7_RULES.length, 7);
  assert.deepEqual(D7_RULES.map((rule) => rule.visualStateId), [
    "suspicious-recipient",
    "recipient-from-page",
    "body-from-page",
    "subject-from-page",
    "memory-from-page",
    "suspicious-memory",
    "allowed",
  ]);
  assert.equal(D7_RULES.filter((rule) => rule.outcome === "blocked").length, 6);
  assert.equal(D7_RULES.at(-1)?.outcome, "allowed");
  assert.ok(D7_RULES[0]?.skippedSteps.length);
  assert.equal(D7_RULES.at(-1)?.skippedSteps.length, 0);
});

test("D8 explicitly maps allowed, denied, timeout, and non-interactive outcomes", () => {
  assert.ok(D8_RULES.some((rule) => rule.visualStateId === "allowed"));
  assert.ok(D8_RULES.some((rule) => rule.visualStateId === "denied"));
  assert.ok(D8_RULES.some((rule) => rule.visualStateId === "timeout"));
  assert.ok(D8_RULES.some((rule) => rule.visualStateId === "non-interactive"));
  assert.ok(D8_RULES.some((rule) => rule.sourceFile === "confirmation/__init__.py"));
  assert.ok(D8_RULES.some((rule) => rule.sourceFile === "sandbox/composite.py"));
});

test("D8 flow states mark only confirmation decision as blocked for denied outcomes", async () => {
  const dataModule = await import("./d3-d8-defense-visualization-data.ts") as typeof import("./d3-d8-defense-visualization-data.ts") & {
    getD8FlowStepStates: (visualStateId: string) => readonly string[];
  };

  assert.deepEqual(dataModule.getD8FlowStepStates("allowed"), ["complete", "complete", "complete", "complete", "complete"]);
  assert.deepEqual(dataModule.getD8FlowStepStates("sandbox-execute"), ["complete", "complete", "complete", "complete", "complete"]);
  for (const visualStateId of ["denied", "timeout", "non-interactive"]) {
    assert.deepEqual(dataModule.getD8FlowStepStates(visualStateId), ["complete", "complete", "complete", "blocked", "idle"]);
  }
  assert.deepEqual(dataModule.getD8FlowStepStates("tool-called"), ["current", "idle", "idle", "idle", "idle"]);
  assert.deepEqual(dataModule.getD8FlowStepStates("confirmation-requested"), ["complete", "current", "idle", "idle", "idle"]);
});
