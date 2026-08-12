const RUN_ID_STORAGE_KEY = "csy_evaluation_workspace_run_id";

function getBrowserSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function isValidEvaluationRunId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 2 &&
    value.length <= 160 &&
    /^[a-zA-Z0-9._:-]+$/.test(value)
  );
}

export function readStoredEvaluationRunId(storage = getBrowserSessionStorage()) {
  if (!storage) {
    return null;
  }

  const value = storage.getItem(RUN_ID_STORAGE_KEY);
  return isValidEvaluationRunId(value) ? value : null;
}

export function storeEvaluationRunId(
  runId: string,
  storage = getBrowserSessionStorage(),
) {
  if (storage && isValidEvaluationRunId(runId)) {
    storage.setItem(RUN_ID_STORAGE_KEY, runId);
  }
}

export function clearEvaluationWorkspaceSession(
  storage = getBrowserSessionStorage(),
) {
  storage?.removeItem(RUN_ID_STORAGE_KEY);
}
