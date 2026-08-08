"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { readEvaluationHandoff } from "../../shared/evaluation-handoff";
import {
  eventStage,
  eventText,
  isTerminalStatus,
  reduceEvaluationEvent,
  type EvaluationReport,
  type EvaluationRun,
  type ExecutionTrace,
  type SequencedEvent,
} from "./evaluation-types";

const RUN_ID_STORAGE_KEY = "csy_evaluation_workspace_run_id";
const DEFAULT_AGENT_ID = "corpmate-v0";
const TEST_CASE_ID = "tc_pipi_001";

type ProviderState = {
  run: EvaluationRun | null;
  events: SequencedEvent[];
  evaluationId: string | null;
  activeStage: ReturnType<typeof eventStage>;
  report: EvaluationReport | null;
  trace: ExecutionTrace | null;
  isBootstrapping: boolean;
  isStarting: boolean;
  isLoadingReport: boolean;
  error: string | null;
  reportError: string | null;
};

type WorkspaceContextValue = ProviderState & {
  startEvaluation: () => Promise<void>;
  retryEvaluation: () => Promise<void>;
  loadReport: () => Promise<void>;
  clearReportError: () => void;
};

export type EvaluationWorkspaceNavigate = (key: "run" | "report") => void;

const EvaluationWorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function isValidRunId(value: unknown): value is string {
  return typeof value === "string" && value.length > 2 && value.length <= 160 && /^[a-zA-Z0-9._:-]+$/.test(value);
}

function getErrorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const error = (value as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}

function readStoredRunId() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.sessionStorage.getItem(RUN_ID_STORAGE_KEY);
  return isValidRunId(value) ? value : null;
}

function persistRunId(runId: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(RUN_ID_STORAGE_KEY, runId);
  }
}

function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ui-${crypto.randomUUID()}`;
  }
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseEvent(data: string, lastEventId: string, fallbackRunId: string): SequencedEvent | null {
  try {
    const event = JSON.parse(data) as SequencedEvent;
    const [eventRunId, rawSeq] = lastEventId.split(":");
    const seq = Number(rawSeq);
    if (!event || event.run_id !== fallbackRunId || !event.event_id || !Number.isInteger(seq) || seq < 1 || eventRunId !== fallbackRunId) {
      return null;
    }
    return { ...event, seq };
  } catch {
    return null;
  }
}

export function EvaluationWorkspaceProvider({ children }: PropsWithChildren<{ onNavigate?: EvaluationWorkspaceNavigate }>) {
  const [state, setState] = useState<ProviderState>({
    run: null,
    events: [],
    evaluationId: null,
    activeStage: null,
    report: null,
    trace: null,
    isBootstrapping: true,
    isStarting: false,
    isLoadingReport: false,
    error: null,
    reportError: null,
  });
  const sourceRef = useRef<EventSource | null>(null);
  const cursorRef = useRef(0);
  const bootstrapRequestIdRef = useRef(newRequestId());

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const setRun = useCallback((run: EvaluationRun, preserveEvents = true) => {
    if (!preserveEvents) {
      cursorRef.current = 0;
    }
    setState((current) => ({
      ...current,
      run,
      evaluationId: run.run_id,
      events: preserveEvents ? current.events : [],
      activeStage: run.current_stage ?? current.activeStage,
      error: run.error?.message ?? null,
      isBootstrapping: false,
    }));
  }, []);

  const startEvaluation = useCallback(async () => {
    const runId = state.evaluationId;
    if (!runId || state.isStarting || !state.run || ["preflighting", "preflight_failed"].includes(state.run.status)) {
      return;
    }
    if (state.run.status === "completed") {
      return;
    }
    setState((current) => ({ ...current, isStarting: true, error: null }));
    try {
      const response = await fetch(`/api/evaluations/${encodeURIComponent(runId)}/start`, { method: "POST" });
      const body = (await response.json()) as EvaluationRun | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(getErrorMessage(body, "测评无法启动"));
      }
      setRun(body as EvaluationRun);
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : "测评无法启动" }));
    } finally {
      setState((current) => ({ ...current, isStarting: false }));
    }
  }, [setRun, state.evaluationId, state.isStarting, state.run]);

  const createEvaluation = useCallback(async (agentId: string, signal?: AbortSignal, requestId = newRequestId()) => {
    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, agent_id: agentId, test_case_ids: [TEST_CASE_ID] }),
      signal,
    });
    const body = (await response.json()) as EvaluationRun | { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(getErrorMessage(body, "测评任务创建失败"));
    }
    const run = body as EvaluationRun;
    persistRunId(run.run_id);
    setRun(run, false);
    return run;
  }, [setRun]);

  const retryEvaluation = useCallback(async () => {
    closeStream();
    const handoff = readEvaluationHandoff();
    const agentId = handoff && typeof handoff.agentId === "string" && handoff.agentId.trim() ? handoff.agentId : DEFAULT_AGENT_ID;
    setState((current) => ({ ...current, isBootstrapping: true, error: null }));
    try {
      await createEvaluation(agentId);
    } catch (error) {
      setState((current) => ({ ...current, isBootstrapping: false, error: error instanceof Error ? error.message : "无法创建新的测评" }));
    }
  }, [closeStream, createEvaluation]);

  useEffect(() => {
    const controller = new AbortController();
    const bootstrap = async () => {
      const storedRunId = readStoredRunId();
      if (storedRunId) {
        try {
          const response = await fetch(`/api/evaluations/${encodeURIComponent(storedRunId)}`, { signal: controller.signal });
          if (response.ok) {
            const run = (await response.json()) as EvaluationRun;
            if (!controller.signal.aborted) {
              setRun(run, false);
            }
            return;
          }
        } catch (error) {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            return;
          }
          // A fresh create below gives the workspace a recoverable state.
        }
      }
      try {
        const handoff = readEvaluationHandoff();
        const agentId = handoff && handoff.testCaseId === TEST_CASE_ID && typeof handoff.agentId === "string" && handoff.agentId.trim() ? handoff.agentId : DEFAULT_AGENT_ID;
        await createEvaluation(agentId, controller.signal, bootstrapRequestIdRef.current);
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setState((current) => ({ ...current, isBootstrapping: false, error: error instanceof Error ? error.message : "测评工作台初始化失败" }));
        }
      }
    };
    void bootstrap();
    return () => controller.abort();
  }, [createEvaluation, setRun]);

  const runStatus = state.run?.status;

  useEffect(() => {
    const runId = state.evaluationId;
    const hasReplayCursor = cursorRef.current > 0;
    if (!runId || !runStatus || ((isTerminalStatus(runStatus) || runStatus === "preflight_failed") && hasReplayCursor)) {
      closeStream();
      return;
    }
    closeStream();
    const after = cursorRef.current;
    const source = new EventSource(`/api/evaluations/${encodeURIComponent(runId)}/events?after=${after}`);
    sourceRef.current = source;
    source.onmessage = (message) => {
      const event = parseEvent(message.data, message.lastEventId, runId);
      if (!event) {
        return;
      }
      cursorRef.current = Math.max(cursorRef.current, event.seq);
      setState((current) => {
        const reduced = reduceEvaluationEvent(current, event);
        if (reduced === current) return current;
        return {
          ...current,
          ...reduced,
        };
      });
      if (event.type === "PREFLIGHT_FAILED" || event.type === "RUN_FINISHED") {
        closeStream();
        void fetch(`/api/evaluations/${encodeURIComponent(runId)}`).then(async (response) => {
          if (response.ok) {
            setRun((await response.json()) as EvaluationRun);
          }
        });
      }
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        return;
      }
      setState((current) => ({ ...current, error: "实时事件流暂时中断，正在等待后端恢复" }));
    };
    return closeStream;
  }, [closeStream, runStatus, setRun, state.evaluationId]);

  useEffect(() => () => closeStream(), [closeStream]);

  const loadReport = useCallback(async () => {
    const runId = state.evaluationId;
    if (!runId || state.isLoadingReport) {
      return;
    }
    setState((current) => ({ ...current, isLoadingReport: true, reportError: null }));
    try {
      const [reportResponse, traceResponse] = await Promise.all([
        fetch(`/api/evaluations/${encodeURIComponent(runId)}/report`),
        fetch(`/api/evaluations/${encodeURIComponent(runId)}/trace`),
      ]);
      const reportBody = (await reportResponse.json()) as EvaluationReport | { error?: { message?: string } };
      if (!reportResponse.ok) {
        throw new Error(getErrorMessage(reportBody, "报告尚未生成"));
      }
      const trace = traceResponse.ok ? ((await traceResponse.json()) as ExecutionTrace) : null;
      setState((current) => ({ ...current, report: reportBody as EvaluationReport, trace, isLoadingReport: false }));
    } catch (error) {
      setState((current) => ({ ...current, isLoadingReport: false, reportError: error instanceof Error ? error.message : "报告读取失败" }));
    }
  }, [state.evaluationId, state.isLoadingReport]);

  useEffect(() => {
    if (state.run?.status === "completed" && !state.report && !state.isLoadingReport) {
      void loadReport();
    }
  }, [loadReport, state.isLoadingReport, state.report, state.run?.status]);

  const clearReportError = useCallback(() => setState((current) => ({ ...current, reportError: null })), []);
  const value = useMemo(() => ({ ...state, startEvaluation, retryEvaluation, loadReport, clearReportError }), [clearReportError, loadReport, retryEvaluation, startEvaluation, state]);

  return <EvaluationWorkspaceContext.Provider value={value}>{children}</EvaluationWorkspaceContext.Provider>;
}

export function useEvaluationWorkspace() {
  const context = useContext(EvaluationWorkspaceContext);
  if (!context) {
    throw new Error("useEvaluationWorkspace must be used inside EvaluationWorkspaceProvider");
  }
  return context;
}

export function EvaluationWorkspaceStatusAnnouncer() {
  const { events } = useEvaluationWorkspace();
  const latest = events.at(-1);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!latest) return;
    const timer = window.setTimeout(() => setAnnouncement(eventText(latest)), 800);
    return () => window.clearTimeout(timer);
  }, [latest]);
  return <span className="evaluation-sr-status" role="status" aria-live="polite">{announcement}</span>;
}
