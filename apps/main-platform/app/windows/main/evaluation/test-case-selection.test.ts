import assert from "node:assert/strict";
import test from "node:test";

import { filterTestCases, selectHandoffTestCase, toggleTestCaseSelection } from "./test-case-selection.ts";

const testCases = [
  { id: "tc-r1", name: "Web injection", description: "Browser payload", risk_type: "indirect_prompt_injection", severity: "HIGH", target_risk_pattern: "R1", turn_count: 1 },
  { id: "tc-r4", name: "Persistent chain", description: "Memory to email", risk_type: "persistent_indirect_prompt_injection", severity: "CRITICAL", target_risk_pattern: "R4", turn_count: 3 },
];

test("test case filtering combines text and risk pattern without mutating input", () => {
  const filtered = filterTestCases(testCases, "memory", "R4");

  assert.deepEqual(filtered.map((item) => item.id), ["tc-r4"]);
  assert.equal(testCases.length, 2);
});

test("a new anatomy handoff replaces an earlier batch selection", () => {
  assert.deepEqual(selectHandoffTestCase("tc_pipi_001"), ["tc_pipi_001"]);
});

test("selection toggles ids while preserving stable order and enforcing uniqueness", () => {
  assert.deepEqual(toggleTestCaseSelection(["tc-r1"], "tc-r4"), ["tc-r1", "tc-r4"]);
  assert.deepEqual(toggleTestCaseSelection(["tc-r1", "tc-r4"], "tc-r1"), ["tc-r4"]);
  assert.deepEqual(toggleTestCaseSelection(["tc-r1", "tc-r1"], "tc-r4"), ["tc-r1", "tc-r4"]);
});
