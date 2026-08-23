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
import { EVALUATION_HANDOFF_EVENT, readEvaluationHandoff, type EvaluationHandoff } from "../../shared/evaluation-handoff";
import { DEFAULT_AGENT_ID } from "../../shared/agent-config";
import { EmailConfirmationDialog } from "./EmailConfirmationDialog";
import {
  DEFAULT_EVALUATION_AGENT_ID,
  getEvaluationAgentMeta,
  type EvaluationAgentId,
} from "./evaluation-agent";
import { enqueueEmailConfirmation, getEmailConfirmationFromEvent, resolveEmailConfirmationQueue, type EmailConfirmation, type EmailConfirmationDecision } from "./email-confirmation";
import {
  clearEvaluationWorkspaceSession,
  readStoredEvaluationRunId,
  storeEvaluationRunId,
} from "./evaluation-session";
import {
  eventStage,
  eventText,
  isTerminalStatus,
  reduceEvaluationEvent,
  type EvaluationReport,
  type EvaluationRun,
  type ExecutionTrace,
  type SequencedEvent,
  type TestCaseSummary,
} from "./evaluation-types";
import { findActiveInference, type ActiveInference } from "./inference-status";
import {
  selectHandoffTestCase,
  toggleTestCaseSelection as toggleTestCaseSelectionIds,
} from "./test-case-selection";
import {
  buildMockEventSequence,
  createMockReport,
  createMockRun,
  createMockTestCases,
  createMockTrace,
} from "./evaluation-mock";

type ProviderState = {
  run: EvaluationRun | null;
  events: SequencedEvent[];
  evaluationId: string | null;
  activeStage: ReturnType<typeof eventStage>;
  report: EvaluationReport | null;
  trace: ExecutionTrace | null;
  testCases: TestCaseSummary[];
  selectedTestCaseIds: string[];
  evaluationAgentId: EvaluationAgentId;
  emailConfirmations: EmailConfirmation[];
  emailConfirmationDecisions: Record<string, EmailConfirmationDecision>;
  isBootstrapping: boolean;
  isLoadingTestCases: boolean;
  isStarting: boolean;
  isLoadingReport: boolean;
  error: string | null;
  reportError: string | null;
  testCaseError: string | null;
};

type WorkspaceContextValue = ProviderState & {
  startEvaluation: () => Promise<void>;
  prepareEvaluation: () => Promise<void>;
  retryEvaluation: () => Promise<void>;
  resetEvaluationSelection: () => void;
  setSelectedTestCaseIds: (ids: string[]) => void;
  toggleTestCaseSelection: (testCaseId: string) => void;
  loadReport: () => Promise<void>;
  clearReportError: () => void;
  setEvaluationAgentId: (agentId: EvaluationAgentId) => void;
  activeInference: ActiveInference | null;
  pendingEmailConfirmation: EmailConfirmation | null;
  resolveEmailConfirmation: (eventId: string, decision: EmailConfirmationDecision) => void;
};

export type EvaluationWorkspaceNavigate = (key: "run" | "report") => void;

const EvaluationWorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function getErrorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const error = (value as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
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

export function EvaluationWorkspaceProvider({
  activeAgentId = DEFAULT_AGENT_ID,
  mockMode = false,
  children,
}: PropsWithChildren<{
  activeAgentId?: string;
  mockMode?: boolean;
  onNavigate?: EvaluationWorkspaceNavigate;
}>) {
  const [state, setState] = useState<ProviderState>(() => ({
    run: null,
    events: [],
    evaluationId: null,
    activeStage: null,
    report: null,
    trace: null,
    testCases: mockMode ? createMockTestCases() : [],
    selectedTestCaseIds: mockMode ? createMockTestCases().map((item) => item.id) : [],
    evaluationAgentId: DEFAULT_EVALUATION_AGENT_ID,
    emailConfirmations: [],
    emailConfirmationDecisions: {},
    isBootstrapping: !mockMode,
    isLoadingTestCases: !mockMode,
    isStarting: false,
    isLoadingReport: false,
    error: null,
    reportError: null,
    testCaseError: null,
  }));
  const sourceRef = useRef<EventSource | null>(null);
  const cursorRef = useRef(0);
  const seenEmailEventIdsRef = useRef(new Set<string>());
  const mockTimersRef = useRef<number[]>([]);
  const mockRunRef = useRef<EvaluationRun | null>(null);
  const mockEventsRef = useRef<SequencedEvent[]>([]);

  const clearMockTimers = useCallback(() => {
    for (const timer of mockTimersRef.current) window.clearTimeout(timer);
    mockTimersRef.current = [];
  }, []);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const setRun = useCallback((run: EvaluationRun, preserveEvents = true) => {
    if (!preserveEvents) {
      cursorRef.current = 0;
      seenEmailEventIdsRef.current.clear();
    }
    setState((current) => ({
      ...current,
      run,
      evaluationId: run.run_id,
      events: preserveEvents ? current.events : [],
      activeStage: preserveEvents ? run.current_stage ?? current.activeStage : run.current_stage ?? null,
      selectedTestCaseIds: run.test_case_ids,
      evaluationAgentId: run.agent_id as EvaluationAgentId,
      emailConfirmations: preserveEvents ? current.emailConfirmations : [],
      emailConfirmationDecisions: preserveEvents ? current.emailConfirmationDecisions : {},
      error: run.error?.message ?? null,
      isBootstrapping: false,
    }));
  }, [mockMode]);

  void activeAgentId;

  const appendMockEvent = useCallback((event: SequencedEvent) => {
    if (!mockMode || !mockRunRef.current) return;
    const events = [...mockEventsRef.current, event];
    const stage = eventStage(event);
    const run: EvaluationRun = {
      ...mockRunRef.current,
      status: event.type === "RUN_STARTED" ? "running" : event.type === "RUN_FINISHED" ? "completed" : mockRunRef.current.status,
      current_stage: stage ?? mockRunRef.current.current_stage,
      last_event_seq: event.seq,
      report_available: event.type === "RUN_FINISHED",
      finished_at: event.type === "RUN_FINISHED" ? event.timestamp : mockRunRef.current.finished_at,
    };
    mockEventsRef.current = events;
    mockRunRef.current = run;
    setState((current) => ({
      ...current,
      run,
      events,
      activeStage: stage ?? current.activeStage,
      report: event.type === "RUN_FINISHED" ? createMockReport(run, events) : current.report,
      trace: event.type === "RUN_FINISHED" ? createMockTrace(run, events) : current.trace,
    }));
  }, [mockMode]);

  const createMockEvaluation = useCallback(async (agentId: string, testCaseIds: string[]) => {
    clearMockTimers();
    const run = createMockRun(`mock-run-${Date.now()}`, agentId, testCaseIds);
    mockRunRef.current = run;
    mockEventsRef.current = [];
    setState((current) => ({
      ...current,
      run,
      events: [],
      evaluationId: run.run_id,
      activeStage: run.current_stage ?? null,
      report: null,
      trace: null,
      selectedTestCaseIds: run.test_case_ids,
      evaluationAgentId: run.agent_id as EvaluationAgentId,
      isBootstrapping: false,
      error: null,
      reportError: null,
      emailConfirmations: [],
      emailConfirmationDecisions: {},
    }));
    return run;
  }, [clearMockTimers]);

  const startMockEvaluation = useCallback(() => {
    const run = mockRunRef.current;
    if (!run || run.status === "completed") return;
    clearMockTimers();
    const queuedRun: EvaluationRun = { ...run, status: "queued", started_at: new Date().toISOString() };
    mockRunRef.current = queuedRun;
    setState((current) => ({ ...current, run: queuedRun, isStarting: false, error: null }));
    for (const [index, event] of buildMockEventSequence(queuedRun).entries()) {
      const timer = window.setTimeout(() => appendMockEvent(event), 260 + index * 260);
      mockTimersRef.current.push(timer);
    }
  }, [appendMockEvent, clearMockTimers]);

  const startEvaluation = useCallback(async () => {
    if (mockMode) {
      startMockEvaluation();
      return;
    }
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
  }, [mockMode, setRun, startMockEvaluation, state.evaluationId, state.isStarting, state.run]);

  const createEvaluation = useCallback(async (agentId: string, testCaseIds: string[], signal?: AbortSignal, requestId = newRequestId()) => {
    if (mockMode) return createMockEvaluation(agentId, testCaseIds);
    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, agent_id: agentId, test_case_ids: testCaseIds }),
      signal,
    });
    const body = (await response.json()) as EvaluationRun | { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(getErrorMessage(body, "测评任务创建失败"));
    }
    const run = body as EvaluationRun;
    storeEvaluationRunId(run.run_id);
    setRun(run, false);
    return run;
  }, [createMockEvaluation, mockMode, setRun]);

  const prepareEvaluation = useCallback(async () => {
    if (state.selectedTestCaseIds.length === 0 || state.isBootstrapping) return;
    const agentId = state.evaluationAgentId;
    setState((current) => ({ ...current, isBootstrapping: true, error: null }));
    try {
      await createEvaluation(agentId, state.selectedTestCaseIds);
    } catch (error) {
      setState((current) => ({ ...current, isBootstrapping: false, error: error instanceof Error ? error.message : "测评任务创建失败" }));
    }
  }, [createEvaluation, state.evaluationAgentId, state.isBootstrapping, state.selectedTestCaseIds]);

  const retryEvaluation = useCallback(async () => {
    closeStream();
    const agentId = state.evaluationAgentId;
    setState((current) => ({ ...current, isBootstrapping: true, error: null }));
    try {
      const testCaseIds = state.run?.test_case_ids.length ? state.run.test_case_ids : state.selectedTestCaseIds;
      if (testCaseIds.length === 0) throw new Error("请先选择 TestCase");
      await createEvaluation(agentId, testCaseIds);
    } catch (error) {
      setState((current) => ({ ...current, isBootstrapping: false, error: error instanceof Error ? error.message : "无法创建新的测评" }));
    }
  }, [closeStream, createEvaluation, state.evaluationAgentId, state.run?.test_case_ids, state.selectedTestCaseIds]);

  const resetEvaluationSelection = useCallback(() => {
    if (mockMode) {
      clearMockTimers();
      mockRunRef.current = null;
      mockEventsRef.current = [];
      setState((current) => ({ ...current, run: null, events: [], evaluationId: null, activeStage: null, report: null, trace: null, isBootstrapping: false, isStarting: false, isLoadingReport: false, error: null, reportError: null, emailConfirmations: [], emailConfirmationDecisions: {} }));
      return;
    }
    closeStream();
    clearEvaluationWorkspaceSession();
    cursorRef.current = 0;
    seenEmailEventIdsRef.current.clear();
    setState((current) => ({
      ...current,
      run: null,
      events: [],
      evaluationId: null,
      activeStage: null,
      report: null,
      trace: null,
      isBootstrapping: false,
      isStarting: false,
      isLoadingReport: false,
      error: null,
      reportError: null,
      emailConfirmations: [],
      emailConfirmationDecisions: {},
    }));
  }, [clearMockTimers, closeStream, mockMode]);

  const adoptEvaluationHandoff = useCallback((handoff: EvaluationHandoff) => {
    closeStream();
    clearEvaluationWorkspaceSession();
    cursorRef.current = 0;
    seenEmailEventIdsRef.current.clear();
    setState((current) => ({
      ...current,
      run: null,
      events: [],
      evaluationId: null,
      activeStage: null,
      report: null,
      trace: null,
      selectedTestCaseIds: selectHandoffTestCase(handoff.testCaseId),
      isBootstrapping: false,
      isStarting: false,
      isLoadingReport: false,
      error: null,
      reportError: null,
      emailConfirmations: [],
      emailConfirmationDecisions: {},
    }));
  }, [closeStream]);

  useEffect(() => {
    if (mockMode) return;
    const handleHandoff = () => {
      const handoff = readEvaluationHandoff();
      if (handoff) adoptEvaluationHandoff(handoff);
    };
    window.addEventListener(EVALUATION_HANDOFF_EVENT, handleHandoff);
    return () => window.removeEventListener(EVALUATION_HANDOFF_EVENT, handleHandoff);
  }, [adoptEvaluationHandoff, mockMode]);

  useEffect(() => {
    if (mockMode) return;
    const controller = new AbortController();
    const bootstrap = async () => {
      const storedRunId = readStoredEvaluationRunId();
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
      if (!controller.signal.aborted) setState((current) => ({ ...current, isBootstrapping: false }));
    };
    void bootstrap();
    return () => controller.abort();
  }, [mockMode, setRun]);

  useEffect(() => {
    if (mockMode) return;
    const controller = new AbortController();
    const loadTestCases = async () => {
      try {
        const response = await fetch("/api/test-cases", { signal: controller.signal });
        const body = (await response.json()) as TestCaseSummary[] | { error?: { message?: string } };
        if (!response.ok || !Array.isArray(body)) throw new Error(getErrorMessage(body, "TestCase 列表读取失败"));
        if (controller.signal.aborted) return;
        const handoff = readEvaluationHandoff();
        const handoffId = handoff && typeof handoff.testCaseId === "string" && body.some((item) => item.id === handoff.testCaseId) ? handoff.testCaseId : null;
        setState((current) => ({
          ...current,
          testCases: body,
          selectedTestCaseIds: current.selectedTestCaseIds.length ? current.selectedTestCaseIds : handoffId ? [handoffId] : body.slice(0, 10).map((item) => item.id),
          isLoadingTestCases: false,
          testCaseError: null,
        }));
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
          setState((current) => ({ ...current, isLoadingTestCases: false, testCaseError: error instanceof Error ? error.message : "TestCase 列表读取失败" }));
        }
      }
    };
    void loadTestCases();
    return () => controller.abort();
  }, [mockMode]);

  const runStatus = state.run?.status;

  useEffect(() => {
    if (mockMode) {
      closeStream();
      return;
    }
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
  }, [closeStream, mockMode, runStatus, setRun, state.evaluationId]);

  useEffect(() => {
    for (const event of state.events) {
      const confirmation = getEmailConfirmationFromEvent(event);
      const result = enqueueEmailConfirmation([], confirmation, seenEmailEventIdsRef.current);
      if (!confirmation || result.queue.length === 0) continue;
      setState((current) => ({
        ...current,
        emailConfirmations: [...current.emailConfirmations, ...result.queue],
      }));
    }
  }, [state.events]);

  const inferenceAgentId = state.run?.agent_id ?? state.evaluationAgentId;
  const [inferenceNow, setInferenceNow] = useState(() => Date.now());
  const activeInference = useMemo(
    () => findActiveInference(state.events, inferenceAgentId, inferenceNow),
    [inferenceAgentId, inferenceNow, state.events],
  );
  const pendingEmailConfirmation = state.emailConfirmations[0] ?? null;

  useEffect(() => {
    if (!activeInference || !getEvaluationAgentMeta(inferenceAgentId).isLlm) return;
    setInferenceNow(Date.now());
    const timer = window.setInterval(() => setInferenceNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeInference?.invoked.event_id, inferenceAgentId]);

  useEffect(() => () => {
    clearMockTimers();
    closeStream();
  }, [clearMockTimers, closeStream]);

  const loadReport = useCallback(async () => {
    const runId = state.evaluationId;
    if (!runId || state.isLoadingReport) {
      return;
    }
    if (mockMode) {
      const run = mockRunRef.current;
      const events = mockEventsRef.current;
      if (run?.status === "completed") {
        setState((current) => ({ ...current, report: createMockReport(run, events), trace: createMockTrace(run, events), isLoadingReport: false, reportError: null }));
      } else {
        setState((current) => ({ ...current, isLoadingReport: false, reportError: "报告尚未生成" }));
      }
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
  }, [mockMode, state.evaluationId, state.isLoadingReport]);

  useEffect(() => {
    if (state.run?.status === "completed" && !state.report && !state.isLoadingReport) {
      void loadReport();
    }
  }, [loadReport, state.isLoadingReport, state.report, state.run?.status]);

  const clearReportError = useCallback(() => setState((current) => ({ ...current, reportError: null })), []);
  const setEvaluationAgentId = useCallback((agentId: EvaluationAgentId) => {
    setState((current) => ({ ...current, evaluationAgentId: agentId }));
  }, [mockMode]);
  const resolveEmailConfirmation = useCallback((eventId: string, decision: EmailConfirmationDecision) => {
    setState((current) => ({
      ...current,
      emailConfirmations: resolveEmailConfirmationQueue(current.emailConfirmations, eventId, decision),
      emailConfirmationDecisions: { ...current.emailConfirmationDecisions, [eventId]: decision },
    }));
  }, []);
  const setSelectedTestCaseIds = useCallback((ids: string[]) => {
    setState((current) => ({ ...current, selectedTestCaseIds: [...new Set(ids)] }));
  }, []);
  const toggleTestCaseSelection = useCallback((testCaseId: string) => {
    setState((current) => ({
      ...current,
      selectedTestCaseIds: toggleTestCaseSelectionIds(current.selectedTestCaseIds, testCaseId),
    }));
  }, []);
  const value = useMemo(() => ({
    ...state,
    startEvaluation,
    prepareEvaluation,
    retryEvaluation,
    resetEvaluationSelection,
    setSelectedTestCaseIds,
    toggleTestCaseSelection,
    loadReport,
    clearReportError,
    setEvaluationAgentId,
    activeInference,
    pendingEmailConfirmation,
    resolveEmailConfirmation,
  }), [activeInference, clearReportError, loadReport, pendingEmailConfirmation, prepareEvaluation, resetEvaluationSelection, resolveEmailConfirmation, retryEvaluation, setEvaluationAgentId, setSelectedTestCaseIds, startEvaluation, state, toggleTestCaseSelection]);

  return <EvaluationWorkspaceContext.Provider value={value}>
    {children}
    <EmailConfirmationDialog confirmation={pendingEmailConfirmation} onDecision={resolveEmailConfirmation} />
  </EvaluationWorkspaceContext.Provider>;
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
