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

test("tc_ipi_001 and tc_def_refuse_002 can be toggled repeatedly without reordering other cases", () => {
  const initialSelection = ["tc-r1", "tc_ipi_001", "tc_def_refuse_002", "tc-r4"];

  const withoutIpi = toggleTestCaseSelection(initialSelection, "tc_ipi_001");
  assert.deepEqual(withoutIpi, ["tc-r1", "tc_def_refuse_002", "tc-r4"]);

  const restoredIpi = toggleTestCaseSelection(withoutIpi, "tc_ipi_001");
  assert.deepEqual(restoredIpi, ["tc-r1", "tc_def_refuse_002", "tc-r4", "tc_ipi_001"]);

  const withoutRefuse = toggleTestCaseSelection(restoredIpi, "tc_def_refuse_002");
  assert.deepEqual(withoutRefuse, ["tc-r1", "tc-r4", "tc_ipi_001"]);
});
