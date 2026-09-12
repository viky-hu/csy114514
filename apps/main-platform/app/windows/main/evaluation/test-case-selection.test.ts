import assert from "node:assert/strict";
import test from "node:test";

import { filterTestCases, selectHandoffTestCase, toggleTestCaseSelection } from "./test-case-selection.ts";

const testCases = [
  { id: "tc-r1", name: "Web injection", description: "Browser payload", risk_type: "indirect_prompt_injection", severity: "HIGH", target_risk_pattern: "R1", turn_count: 1 },
  { id: "tc-r4", name: "Persistent chain", description: "Memory to email", risk_type: "persistent_indirect_prompt_injection", severity: "CRITICAL", target_risk_pattern: "R4", turn_count: 3 },
  { id: "tc-r5", name: "Planner poisoning", description: "Task plan payload", risk_type: "planner_poisoning", severity: "HIGH", target_risk_pattern: "R5", turn_count: 2 },
  { id: "tc-r6", name: "RAG poisoning", description: "Knowledge context payload", risk_type: "rag_context_poisoning", severity: "HIGH", target_risk_pattern: "R6", turn_count: 2 },
];

test("test case filtering combines text and risk pattern without mutating input", () => {
  const filtered = filterTestCases(testCases, "memory", "R4");

  assert.deepEqual(filtered.map((item) => item.id), ["tc-r4"]);
  assert.equal(testCases.length, 4);
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
test("filters topology risk patterns without inventing cases", () => {
  assert.deepEqual(filterTestCases(testCases, "", "R5").map((item) => item.id), ["tc-r5"]);
  assert.deepEqual(filterTestCases(testCases, "knowledge", "R6").map((item) => item.id), ["tc-r6"]);
  assert.deepEqual(filterTestCases(testCases, "", "R2"), []);
});
