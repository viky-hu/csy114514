import {
  getLoadingTips,
  type LoadingTip,
  type LoadingTipPhase,
} from "../shared/loading-tips.ts";

export const LOGIN_LOADING_MOCK_MIN_MS = 7000;
export const LOGIN_LOADING_MOCK_MAX_MS = 10000;
export const LOGIN_LOADING_TIP_EXIT_MS = 180;

const LOGIN_LOADING_TIP_ENTRANCE_BASE_MS = 280;
const LOGIN_LOADING_TIP_ENTRANCE_STAGGER_MS = 20;
const LOGIN_LOADING_TIP_ENTRANCE_MAX_MS = 650;
const LOGIN_LOADING_TIP_HOLD_MIN_MS = 1050;
const LOGIN_LOADING_TIP_HOLD_MAX_MS = 1500;

export type LoginLoadingTipPresentation = {
  entranceMs: number;
  holdMs: number;
  tip: LoadingTip;
  totalDurationMs: number;
};

export type LoginMockLoadingPlan = {
  steps: LoginLoadingTipPresentation[];
  totalDurationMs: number;
};

export type LoginLoadingProgressEvent =
  | { phase: LoadingTipPhase; type: "phase" }
  | { type: "complete" }
  | { message?: string; type: "failed" };

export type LoginLoadingTipSequenceAction =
  | { kind: "tip"; presentation: LoginLoadingTipPresentation }
  | { kind: "complete" }
  | { kind: "failed"; message?: string };

function stableHash(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function countCharacters(text: string) {
  return [...text].length;
}

function getEntranceMs(text: string) {
  return Math.min(
    LOGIN_LOADING_TIP_ENTRANCE_BASE_MS +
      Math.max(countCharacters(text) - 1, 0) * LOGIN_LOADING_TIP_ENTRANCE_STAGGER_MS,
    LOGIN_LOADING_TIP_ENTRANCE_MAX_MS,
  );
}

function getHoldMs(tip: LoadingTip) {
  const stableVariation = (stableHash(tip.id) % 321) - 160;
  const lengthContribution = Math.min(countCharacters(tip.text) * 24, 360);

  return Math.min(
    Math.max(
      1100 + lengthContribution + stableVariation,
      LOGIN_LOADING_TIP_HOLD_MIN_MS,
    ),
    LOGIN_LOADING_TIP_HOLD_MAX_MS,
  );
}

function createPresentation(tip: LoadingTip): LoginLoadingTipPresentation {
  const entranceMs = getEntranceMs(tip.text);
  const holdMs = getHoldMs(tip);

  return {
    entranceMs,
    holdMs,
    tip,
    totalDurationMs: entranceMs + holdMs + LOGIN_LOADING_TIP_EXIT_MS,
  };
}

function orderedTips(agentId: string, phase: LoadingTipPhase) {
  const tips = getLoadingTips(phase);
  const fallbackTips = tips.length > 0 ? tips : getLoadingTips("boot");

  if (fallbackTips.length === 0) {
    return [];
  }

  const startIndex = stableHash(`${agentId}:${phase}`) % fallbackTips.length;

  return Array.from(
    { length: fallbackTips.length },
    (_, index) => fallbackTips[(startIndex + index) % fallbackTips.length],
  );
}

function createPhaseCycle(agentId: string, phase: LoadingTipPhase) {
  return orderedTips(agentId, phase).map(createPresentation);
}

export function createLoginMockLoadingPlan(agentId: string): LoginMockLoadingPlan {
  const steps: LoginLoadingTipPresentation[] = [];
  let totalDurationMs = 0;

  for (const tip of orderedTips(agentId, "boot")) {
    const presentation = createPresentation(tip);
    steps.push(presentation);
    totalDurationMs += presentation.totalDurationMs;

    if (steps.length >= 3 && totalDurationMs >= LOGIN_LOADING_MOCK_MIN_MS) {
      break;
    }
  }

  return { steps, totalDurationMs };
}

export class LoginLoadingTipSequence {
  private readonly agentId: string;
  private currentIndex = 0;
  private currentPlan: LoginLoadingTipPresentation[];
  private isMockPlan = true;
  private pendingOutcome: Extract<
    LoginLoadingProgressEvent,
    { type: "complete" | "failed" }
  > | null = null;
  private pendingPhase: LoadingTipPhase | null = null;

  public constructor(agentId: string) {
    this.agentId = agentId;
    this.currentPlan = createLoginMockLoadingPlan(agentId).steps;
  }

  public start(): LoginLoadingTipSequenceAction {
    return this.getCurrentTip();
  }

  public request(event: LoginLoadingProgressEvent) {
    if (event.type === "phase") {
      this.pendingPhase = event.phase;
      return;
    }

    this.pendingOutcome = event;
  }

  public advanceAfterExit(): LoginLoadingTipSequenceAction {
    if (this.pendingOutcome) {
      const outcome = this.pendingOutcome;
      this.pendingOutcome = null;

      return outcome.type === "failed"
        ? { kind: "failed", message: outcome.message }
        : { kind: "complete" };
    }

    if (this.pendingPhase) {
      this.currentPlan = createPhaseCycle(this.agentId, this.pendingPhase);
      this.currentIndex = 0;
      this.isMockPlan = false;
      this.pendingPhase = null;

      return this.getCurrentTip();
    }

    if (this.currentIndex + 1 < this.currentPlan.length) {
      this.currentIndex += 1;
      return this.getCurrentTip();
    }

    if (this.isMockPlan) {
      return { kind: "complete" };
    }

    this.currentIndex = 0;
    return this.getCurrentTip();
  }

  private getCurrentTip(): LoginLoadingTipSequenceAction {
    const presentation = this.currentPlan[this.currentIndex];

    return presentation ? { kind: "tip", presentation } : { kind: "complete" };
  }
}

export function createLoginLoadingTipSequence(agentId: string) {
  return new LoginLoadingTipSequence(agentId);
}
