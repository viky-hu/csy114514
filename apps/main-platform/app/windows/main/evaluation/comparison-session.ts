const COMPARISON_ID_STORAGE_KEY = "csy_evaluation_workspace_comparison_id";

function getBrowserSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function isValidEvaluationComparisonId(value: unknown): value is string {
  return typeof value === "string" && value.length > 2 && value.length <= 160 && /^[a-zA-Z0-9._:-]+$/.test(value);
}

export function readStoredEvaluationComparisonId(storage = getBrowserSessionStorage()) {
  const value = storage?.getItem(COMPARISON_ID_STORAGE_KEY);
  return isValidEvaluationComparisonId(value) ? value : null;
}

export function storeEvaluationComparisonId(id: string, storage = getBrowserSessionStorage()) {
  if (storage && isValidEvaluationComparisonId(id)) storage.setItem(COMPARISON_ID_STORAGE_KEY, id);
}

export function clearEvaluationComparisonSession(storage = getBrowserSessionStorage()) {
  storage?.removeItem(COMPARISON_ID_STORAGE_KEY);
}
