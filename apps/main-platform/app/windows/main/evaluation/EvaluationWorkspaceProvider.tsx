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
  type EvaluationAgentId,
} from "./evaluation-agent";
import { enqueueEmailConfirmation, getEmailConfirmationFromEvent, resolveEmailConfirmationQueue, type EmailConfirmation, type EmailConfirmationDecision } from "./email-confirmation";
import {
  clearEvaluationWorkspaceSession,
  readStoredEvaluationRunId,
  storeEvaluationRunId,
} from "./evaluation-session";
import {
  clearEvaluationComparisonSession,
  readStoredEvaluationComparisonId,
  storeEvaluationComparisonId,
} from "./comparison-session";
import {
  reduceComparisonStreamEvent,
  type ComparisonStreamState,
} from "./comparison-progress";
import type {
  ComparisonReport,
  ComparisonSide,
  ComparisonStreamEvent,
  EvaluationComparison,
} from "./comparison-types";
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
  evaluationMode: "single" | "comparison";
  comparison: EvaluationComparison | null;
  comparisonEvents: ComparisonStreamState["events"];
  comparisonReport: ComparisonReport | null;
  isLoadingComparisonReport: boolean;
  comparisonError: string | null;
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
  prepareComparison: () => Promise<void>;
  startComparison: () => Promise<void>;
  retryEvaluation: () => Promise<void>;
  resetEvaluationSelection: () => void;
  setSelectedTestCaseIds: (ids: string[]) => void;
  toggleTestCaseSelection: (testCaseId: string) => void;
  loadReport: () => Promise<void>;
  loadComparisonReport: () => Promise<void>;
  retryComparison: (side: ComparisonSide) => Promise<void>;
  clearReportError: () => void;
  setEvaluationAgentId: (agentId: EvaluationAgentId) => void;
  setEvaluationMode: (mode: "single" | "comparison") => void;
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
    evaluationMode: "single",
    comparison: null,
    comparisonEvents: EMPTY_COMPARISON_EVENTS,
    comparisonReport: null,
    isLoadingComparisonReport: false,
    comparisonError: null,
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
  const mockComparisonRunsRef = useRef<Record<ComparisonSide, EvaluationRun> | null>(null);
  const mockComparisonEventsRef = useRef<ComparisonStreamState["events"]>(EMPTY_COMPARISON_EVENTS);
  const comparisonCursorRef = useRef(0);
  const comparisonSeenEventsRef = useRef(new Set<string>());

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
      evaluationMode: "single",
      comparison: null,
      comparisonReport: null,
      comparisonError: null,
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

  const createComparison = useCallback(async (testCaseIds: string[], requestId = newRequestId()) => {
    if (mockMode) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const bareRun = createMockRun(`mock-bare-${Date.now()}`, "llm-agent-v0", testCaseIds);
      const defendedRun = createMockRun(`mock-defended-${Date.now() + 1}`, "defended-llm-v0", testCaseIds);
      const comparison: EvaluationComparison = {
        comparison_id: `mock-comparison-${Date.now()}`,
        mode: "bare_vs_defended",
        test_case_ids: testCaseIds,
        bare_run_id: bareRun.run_id,
        defended_run_id: defendedRun.run_id,
        status: "queued",
        comparison_seed: "mock-seed",
        bare_run: bareRun,
        defended_run: defendedRun,
      };
      mockComparisonRunsRef.current = { bare: bareRun, defended: defendedRun };
      mockComparisonEventsRef.current = { bare: [], defended: [] };
      setState((current) => ({
        ...current,
        run: null,
        events: [],
        evaluationId: null,
        comparison,
        comparisonEvents: EMPTY_COMPARISON_EVENTS,
        comparisonReport: null,
        evaluationMode: "comparison",
        isBootstrapping: false,
        isLoadingComparisonReport: false,
        error: null,
        comparisonError: null,
      }));
      return comparison;
    }
    const response = await fetch("/api/evaluations/comparisons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: requestId, test_case_ids: testCaseIds }) });
    const body = (await response.json()) as EvaluationComparison | { error?: { message?: string } };
    if (!response.ok) throw new Error(getErrorMessage(body, "比较任务创建失败"));
    const comparison = body as EvaluationComparison;
    storeEvaluationComparisonId(comparison.comparison_id);
    comparisonCursorRef.current = 0;
    comparisonSeenEventsRef.current.clear();
    setState((current) => ({ ...current, run: null, events: [], evaluationId: null, comparison, comparisonEvents: EMPTY_COMPARISON_EVENTS, comparisonReport: null, evaluationMode: "comparison", isBootstrapping: false, error: null, comparisonError: null }));
    return comparison;
  }, [mockMode]);

  const appendMockComparisonEvent = useCallback((side: ComparisonSide, event: SequencedEvent) => {
    const runs = mockComparisonRunsRef.current;
    if (!mockMode || !runs) return;
    const events = {
      ...mockComparisonEventsRef.current,
      [side]: [...mockComparisonEventsRef.current[side], event],
    };
    const previousRun = runs[side];
    const nextRun: EvaluationRun = {
      ...previousRun,
      status: event.type === "RUN_STARTED" ? "running" : event.type === "RUN_FINISHED" ? "completed" : previousRun.status,
      current_stage: eventStage(event) ?? previousRun.current_stage,
      last_event_seq: event.seq,
      report_available: event.type === "RUN_FINISHED",
      started_at: event.type === "RUN_STARTED" ? event.timestamp : previousRun.started_at,
      finished_at: event.type === "RUN_FINISHED" ? event.timestamp : previousRun.finished_at,
    };
    const nextRuns = { ...runs, [side]: nextRun };
    mockComparisonRunsRef.current = nextRuns;
    mockComparisonEventsRef.current = events;
    setState((current) => {
      if (!current.comparison) return current;
      const comparisonStatus = nextRuns.bare.status === "completed" && nextRuns.defended.status === "completed"
        ? "completed"
        : "running_parallel";
      const nextComparison = {
        ...current.comparison,
        status: comparisonStatus as EvaluationComparison["status"],
        bare_run: nextRuns.bare,
        defended_run: nextRuns.defended,
      };
      return {
        ...current,
        comparison: nextComparison,
        comparisonEvents: events,
        comparisonReport: comparisonStatus === "completed"
          ? buildMockComparisonReport(nextComparison, events)
          : null,
      };
    });
  }, [mockMode]);

  const startMockComparison = useCallback(() => {
    const runs = mockComparisonRunsRef.current;
    const comparison = state.comparison;
    if (!runs || !comparison || comparison.status === "completed") return;
    clearMockTimers();
    setState((current) => ({ ...current, isStarting: false, comparison: current.comparison ? { ...current.comparison, status: "running_parallel" } : current.comparison, comparisonError: null }));
    const baseTimestamp = Date.now();
    const sequences = {
      bare: buildMockEventSequence({ ...runs.bare, status: "queued" }, baseTimestamp),
      defended: buildMockEventSequence({ ...runs.defended, status: "queued" }, baseTimestamp + 120),
    };
    for (const side of ["bare", "defended"] as const) {
      for (const [index, event] of sequences[side].entries()) {
        const timer = window.setTimeout(
          () => appendMockComparisonEvent(side, event),
          240 + index * 230 + (side === "defended" ? 115 : 0),
        );
        mockTimersRef.current.push(timer);
      }
    }
  }, [appendMockComparisonEvent, clearMockTimers, state.comparison]);

  const startComparison = useCallback(async () => {
    if (mockMode) {
      startMockComparison();
      return;
    }
    const comparisonId = state.comparison?.comparison_id;
    if (!comparisonId || state.isStarting || state.comparison?.status !== "queued") return;
    setState((current) => ({ ...current, isStarting: true, comparisonError: null }));
    try {
      const response = await fetch(`/api/evaluations/comparisons/${encodeURIComponent(comparisonId)}/start`, { method: "POST" });
      const body = (await response.json()) as EvaluationComparison | { error?: { message?: string } };
      if (!response.ok) throw new Error(getErrorMessage(body, "比较测评无法启动"));
      setState((current) => ({ ...current, comparison: body as EvaluationComparison, isStarting: false }));
    } catch (error) {
      setState((current) => ({ ...current, isStarting: false, comparisonError: error instanceof Error ? error.message : "比较测评无法启动" }));
    }
  }, [mockMode, startMockComparison, state.comparison, state.isStarting]);

  const prepareEvaluation = useCallback(async () => {
    if (state.selectedTestCaseIds.length === 0 || state.isBootstrapping) return;
    if (state.evaluationMode === "comparison") {
      return;
    }
    const agentId = state.evaluationAgentId;
    setState((current) => ({ ...current, isBootstrapping: true, error: null }));
    try {
      await createEvaluation(agentId, state.selectedTestCaseIds);
    } catch (error) {
      setState((current) => ({ ...current, isBootstrapping: false, error: error instanceof Error ? error.message : "测评任务创建失败" }));
    }
  }, [createEvaluation, state.evaluationAgentId, state.evaluationMode, state.isBootstrapping, state.selectedTestCaseIds]);

  const prepareComparison = useCallback(async () => {
    if (state.selectedTestCaseIds.length === 0 || state.isBootstrapping) return;
    setState((current) => ({ ...current, isBootstrapping: true, error: null, comparisonError: null }));
    try {
      await createComparison(state.selectedTestCaseIds);
    } catch (error) {
      setState((current) => ({ ...current, isBootstrapping: false, error: error instanceof Error ? error.message : "比较任务创建失败" }));
    }
  }, [createComparison, state.isBootstrapping, state.selectedTestCaseIds]);

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

  const retryComparison = useCallback(async (side: ComparisonSide) => {
    if (!state.comparison || mockMode) return;
    setState((current) => ({ ...current, isBootstrapping: true, comparisonError: null }));
    try {
      const response = await fetch(`/api/evaluations/comparisons/${encodeURIComponent(state.comparison.comparison_id)}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ side }) });
      const body = (await response.json()) as EvaluationComparison | { error?: { message?: string } };
      if (!response.ok) throw new Error(getErrorMessage(body, "比较侧重试失败"));
      setState((current) => ({
        ...current,
        comparison: body as EvaluationComparison,
        comparisonEvents: { ...current.comparisonEvents, [side]: [] },
        comparisonReport: null,
        isBootstrapping: false,
      }));
    } catch (error) {
      setState((current) => ({ ...current, isBootstrapping: false, comparisonError: error instanceof Error ? error.message : "比较侧重试失败" }));
    }
  }, [mockMode, state.comparison]);

  const resetEvaluationSelection = useCallback(() => {
    if (mockMode) {
      clearMockTimers();
      mockRunRef.current = null;
      mockEventsRef.current = [];
      mockComparisonRunsRef.current = null;
      mockComparisonEventsRef.current = EMPTY_COMPARISON_EVENTS;
      setState((current) => ({ ...current, run: null, events: [], evaluationId: null, activeStage: null, report: null, trace: null, comparison: null, comparisonEvents: EMPTY_COMPARISON_EVENTS, comparisonReport: null, evaluationMode: "single", isBootstrapping: false, isStarting: false, isLoadingReport: false, isLoadingComparisonReport: false, error: null, reportError: null, comparisonError: null, emailConfirmations: [], emailConfirmationDecisions: {} }));
      return;
    }
    closeStream();
    clearEvaluationWorkspaceSession();
    clearEvaluationComparisonSession();
    cursorRef.current = 0;
    seenEmailEventIdsRef.current.clear();
    comparisonCursorRef.current = 0;
    comparisonSeenEventsRef.current.clear();
    setState((current) => ({
      ...current,
      run: null,
      events: [],
      evaluationId: null,
      activeStage: null,
      report: null,
      trace: null,
      comparison: null,
      comparisonEvents: EMPTY_COMPARISON_EVENTS,
      comparisonReport: null,
      evaluationMode: "single",
      isBootstrapping: false,
      isStarting: false,
      isLoadingReport: false,
      error: null,
      reportError: null,
      comparisonError: null,
      emailConfirmations: [],
      emailConfirmationDecisions: {},
    }));
  }, [clearMockTimers, closeStream, mockMode]);

  const adoptEvaluationHandoff = useCallback((handoff: EvaluationHandoff) => {
    closeStream();
    clearEvaluationWorkspaceSession();
    clearEvaluationComparisonSession();
    cursorRef.current = 0;
    seenEmailEventIdsRef.current.clear();
    comparisonCursorRef.current = 0;
    comparisonSeenEventsRef.current.clear();
    setState((current) => ({
      ...current,
      run: null,
      events: [],
      evaluationId: null,
      activeStage: null,
      report: null,
      trace: null,
      comparison: null,
      comparisonEvents: EMPTY_COMPARISON_EVENTS,
      comparisonReport: null,
      evaluationMode: "single",
      selectedTestCaseIds: selectHandoffTestCase(handoff.testCaseId),
      isBootstrapping: false,
      isStarting: false,
      isLoadingReport: false,
      error: null,
      reportError: null,
      comparisonError: null,
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
      const storedComparisonId = readStoredEvaluationComparisonId();
      if (storedComparisonId) {
        try {
          const response = await fetch(`/api/evaluations/comparisons/${encodeURIComponent(storedComparisonId)}`, { signal: controller.signal });
          if (response.ok) {
            const comparison = (await response.json()) as EvaluationComparison;
            if (!controller.signal.aborted) {
              comparisonCursorRef.current = 0;
              comparisonSeenEventsRef.current.clear();
              setState((current) => ({ ...current, comparison, comparisonEvents: EMPTY_COMPARISON_EVENTS, comparisonReport: null, evaluationMode: "comparison", isBootstrapping: false }));
            }
            return;
          }
        } catch (error) {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        }
      }
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
    if (mockMode || !state.comparison) return;
    const comparisonId = state.comparison.comparison_id;
    const controller = new AbortController();
    comparisonCursorRef.current = 0;
    comparisonSeenEventsRef.current.clear();
    const source = new EventSource(`/api/evaluations/comparisons/${encodeURIComponent(comparisonId)}/events?after=0`);
    sourceRef.current = source;
    source.onmessage = (message) => {
      const streamEvent = parseComparisonEvent(message.data, message.lastEventId, comparisonId);
      if (!streamEvent) return;
      const key = `${streamEvent.side}:${streamEvent.event.run_id}:${streamEvent.run_seq}`;
      if (comparisonSeenEventsRef.current.has(key)) return;
      comparisonSeenEventsRef.current.add(key);
      comparisonCursorRef.current = Math.max(comparisonCursorRef.current, streamEvent.seq);
      setState((current) => ({
        ...current,
        comparisonError: null,
        comparisonEvents: reduceComparisonStreamEvent(
          { cursor: comparisonCursorRef.current, events: current.comparisonEvents },
          streamEvent,
        ).events,
      }));
      void fetch(`/api/evaluations/comparisons/${encodeURIComponent(comparisonId)}`, { signal: controller.signal }).then(async (response) => {
        if (response.ok && !controller.signal.aborted) {
          const nextComparison = await response.json() as EvaluationComparison;
          if (!controller.signal.aborted) {
            setState((current) => {
              const sideRunChanged = {
                bare: current.comparison?.bare_run_id !== nextComparison.bare_run_id,
                defended: current.comparison?.defended_run_id !== nextComparison.defended_run_id,
              };
              return {
                ...current,
                comparison: nextComparison,
                comparisonEvents: {
                  bare: sideRunChanged.bare ? [] : current.comparisonEvents.bare,
                  defended: sideRunChanged.defended ? [] : current.comparisonEvents.defended,
                },
              };
            });
          }
        }
      }).catch(() => undefined);
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        return;
      }
      setState((current) => ({ ...current, comparisonError: "比较事件流暂时中断，正在等待后端恢复" }));
    };
    return () => { controller.abort(); source.close(); if (sourceRef.current === source) sourceRef.current = null; };
  }, [mockMode, state.comparison?.comparison_id]);

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
    for (const event of [
      ...state.events,
      ...state.comparisonEvents.bare,
      ...state.comparisonEvents.defended,
    ]) {
      const confirmation = getEmailConfirmationFromEvent(event);
      const result = enqueueEmailConfirmation([], confirmation, seenEmailEventIdsRef.current);
      if (!confirmation || result.queue.length === 0) continue;
      setState((current) => ({
        ...current,
        emailConfirmations: [...current.emailConfirmations, ...result.queue],
      }));
    }
  }, [state.events]);

  const pendingEmailConfirmation = state.emailConfirmations[0] ?? null;

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

  const loadComparisonReport = useCallback(async () => {
    const comparisonId = state.comparison?.comparison_id;
    if (!comparisonId || state.isLoadingComparisonReport || mockMode) return;
    setState((current) => ({ ...current, isLoadingComparisonReport: true, comparisonError: null }));
    try {
      const response = await fetch(`/api/evaluations/comparisons/${encodeURIComponent(comparisonId)}/report`);
      const body = (await response.json()) as ComparisonReport | { error?: { message?: string } };
      if (!response.ok) throw new Error(getErrorMessage(body, "比较报告尚未生成"));
      setState((current) => ({ ...current, comparisonReport: body as ComparisonReport, isLoadingComparisonReport: false }));
    } catch (error) {
      setState((current) => ({ ...current, isLoadingComparisonReport: false, comparisonError: error instanceof Error ? error.message : "比较报告读取失败" }));
    }
  }, [mockMode, state.comparison?.comparison_id, state.isLoadingComparisonReport]);

  useEffect(() => {
    if (state.run?.status === "completed" && !state.report && !state.isLoadingReport) {
      void loadReport();
    }
  }, [loadReport, state.isLoadingReport, state.report, state.run?.status]);

  useEffect(() => {
    if (state.comparison?.status === "completed" && !state.comparisonReport && !state.isLoadingComparisonReport) void loadComparisonReport();
  }, [loadComparisonReport, state.comparison?.status, state.comparisonReport, state.isLoadingComparisonReport]);

  const clearReportError = useCallback(() => setState((current) => ({ ...current, reportError: null })), []);
  const setEvaluationAgentId = useCallback((agentId: EvaluationAgentId) => {
    setState((current) => ({ ...current, evaluationAgentId: agentId }));
  }, []);
  const setEvaluationMode = useCallback((mode: "single" | "comparison") => {
    setState((current) => ({ ...current, evaluationMode: mode, comparisonError: null }));
  }, []);
  const resolveEmailConfirmation = useCallback((eventId: string, decision: EmailConfirmationDecision) => {
    setState((current) => ({
      ...current,
      emailConfirmations: resolveEmailConfirmationQueue(current.emailConfirmations, eventId, decision),
      emailConfirmationDecisions: { ...current.emailConfirmationDecisions, [eventId]: decision },
    }));

    // D3 闭环: 回传用户决定到后端, 解除执行线程阻塞
    if (decision !== "dismissed" && state.evaluationId) {
      fetch(
        `/api/evaluations/${encodeURIComponent(state.evaluationId)}/confirmations/${encodeURIComponent(eventId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      ).catch((err) => console.error("[D3] confirmation callback failed:", err));
    }
  }, [state.evaluationId]);
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
    prepareComparison,
    startComparison,
    retryEvaluation,
    resetEvaluationSelection,
    setSelectedTestCaseIds,
    toggleTestCaseSelection,
    loadReport,
    loadComparisonReport,
    retryComparison,
    clearReportError,
    setEvaluationAgentId,
    setEvaluationMode,
    pendingEmailConfirmation,
    resolveEmailConfirmation,
  }), [clearReportError, loadComparisonReport, loadReport, pendingEmailConfirmation, prepareComparison, prepareEvaluation, resetEvaluationSelection, resolveEmailConfirmation, retryComparison, retryEvaluation, setEvaluationAgentId, setEvaluationMode, setSelectedTestCaseIds, startComparison, startEvaluation, state, toggleTestCaseSelection]);

  return <EvaluationWorkspaceContext.Provider value={value}>
    {children}
    <EmailConfirmationDialog confirmation={pendingEmailConfirmation} onDecision={resolveEmailConfirmation} />
  </EvaluationWorkspaceContext.Provider>;
}

function parseComparisonEvent(data: string, lastEventId: string, comparisonId: string): ComparisonStreamEvent | null {
  try {
    const item = JSON.parse(data) as ComparisonStreamEvent;
    const [eventComparisonId, rawSeq] = lastEventId.split(":");
    const seq = Number(rawSeq);
    if (
      !item
      || eventComparisonId !== comparisonId
      || !Number.isInteger(seq)
      || seq < 1
      || item.seq !== seq
      || !["bare", "defended"].includes(item.side)
      || !item.event?.event_id
      || !item.event?.run_id
      || !Number.isInteger(item.run_seq)
      || item.run_seq < 1
    ) {
      return null;
    }
    return item;
  } catch {
    return null;
  }
}

const EMPTY_COMPARISON_EVENTS: ComparisonStreamState["events"] = {
  bare: [],
  defended: [],
};

function buildMockComparisonReport(
  comparison: EvaluationComparison,
  events: ComparisonStreamState["events"],
): ComparisonReport {
  const resultByCase = new Map<string, ComparisonReport["results"][number]>();
  for (const testCaseId of comparison.test_case_ids) {
    const bareEvent = [...events.bare].reverse().find((event) => event.type === "TEST_COMPLETED" && event.payload?.test_case_id === testCaseId);
    const defendedEvent = [...events.defended].reverse().find((event) => event.type === "TEST_COMPLETED" && event.payload?.test_case_id === testCaseId);
    const bareVerdict = typeof bareEvent?.payload?.verdict === "string" ? bareEvent.payload.verdict : null;
    const defendedVerdict = typeof defendedEvent?.payload?.verdict === "string" ? defendedEvent.payload.verdict : null;
    const transition = bareVerdict === "FAIL" && defendedVerdict === "PASS"
      ? "defense_blocked"
      : bareVerdict === "PASS" && defendedVerdict === "PASS"
        ? "both_pass"
        : bareVerdict === "FAIL" && defendedVerdict === "FAIL"
          ? "defense_failed"
          : bareVerdict === "PASS" && defendedVerdict === "FAIL"
            ? "possible_regression"
            : "incomplete";
    resultByCase.set(testCaseId, {
      test_case_id: testCaseId,
      bare_verdict: bareVerdict,
      defended_verdict: defendedVerdict,
      transition,
      bare_findings: [],
      defended_findings: [],
    });
  }
  const results = [...resultByCase.values()];
  const comparable = results.filter((row) => ["PASS", "FAIL"].includes(row.bare_verdict ?? "") && ["PASS", "FAIL"].includes(row.defended_verdict ?? ""));
  const barePassed = comparable.filter((row) => row.bare_verdict === "PASS").length;
  const defendedPassed = comparable.filter((row) => row.defended_verdict === "PASS").length;
  const bareRate = comparable.length ? barePassed / comparable.length : 0;
  const defendedRate = comparable.length ? defendedPassed / comparable.length : 0;
  return {
    comparison_id: comparison.comparison_id,
    mode: comparison.mode,
    test_case_ids: comparison.test_case_ids,
    status: comparison.status,
    bare_run_id: comparison.bare_run_id,
    defended_run_id: comparison.defended_run_id,
    summary: {
      total: results.length,
      comparable: comparable.length,
      bare_passed: barePassed,
      defended_passed: defendedPassed,
      defense_blocked: results.filter((row) => row.transition === "defense_blocked").length,
      bare_pass_rate: bareRate,
      defended_pass_rate: defendedRate,
      pass_rate_delta: defendedRate - bareRate,
    },
    results,
  };
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
