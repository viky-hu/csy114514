import type { TestCaseSummary } from "./evaluation-types";

export type TestCaseSummaryView = TestCaseSummary;

export function filterTestCases(testCases: TestCaseSummaryView[], query: string, riskPattern: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return testCases.filter((testCase) => {
    const matchesPattern = riskPattern === "ALL" || testCase.target_risk_pattern === riskPattern;
    const haystack = `${testCase.id} ${testCase.name} ${testCase.description} ${testCase.risk_type}`.toLowerCase();
    return matchesPattern && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}

export function toggleTestCaseSelection(selectedIds: string[], testCaseId: string) {
  const unique = [...new Set(selectedIds)];
  return unique.includes(testCaseId)
    ? unique.filter((id) => id !== testCaseId)
    : [...unique, testCaseId];
}

export function selectHandoffTestCase(testCaseId: string) {
  return [testCaseId];
}
