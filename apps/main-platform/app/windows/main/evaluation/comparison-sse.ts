export type ComparisonTerminalStatus = "completed" | "partial" | "failed" | string;
export type ComparisonSnapshotResult = "ok" | "not_found" | "unavailable";
export type ComparisonStreamFailure = "retrying" | "warning" | "closed" | "fatal";

const RECONNECT_GRACE_MS = 10_000;

export function shouldCloseComparisonStream(status: ComparisonTerminalStatus) {
  return status === "completed" || status === "partial" || status === "failed";
}

export function classifyComparisonStreamFailure(input: {
  readyState: number;
  snapshotStatus: ComparisonTerminalStatus | null;
  snapshotResult: ComparisonSnapshotResult;
  elapsedSinceLastOpenMs: number;
}): ComparisonStreamFailure {
  if (shouldCloseComparisonStream(input.snapshotStatus ?? "")) return "closed";
  if (input.snapshotResult === "not_found") return "fatal";
  if (input.snapshotResult === "unavailable") {
    return input.elapsedSinceLastOpenMs >= RECONNECT_GRACE_MS ? "warning" : "retrying";
  }
  if (input.readyState === 2) return "fatal";
  return input.elapsedSinceLastOpenMs >= RECONNECT_GRACE_MS ? "warning" : "retrying";
}

export function shouldRestartComparisonStream(
  previous: { bare: string | null; defended: string | null },
  next: { bare: string | null; defended: string | null },
) {
  return previous.bare !== next.bare || previous.defended !== next.defended;
}
