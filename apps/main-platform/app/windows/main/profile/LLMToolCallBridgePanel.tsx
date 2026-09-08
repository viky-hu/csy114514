"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  Ban,
  Brain,
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { LINE_DRAW_EASE } from "../../shared/animation";
import {
  D2_HANDOFF_SUMMARY,
  LLM_REASONING_STEPS,
  SANDBOX_CONFIRMATION,
  TOOL_CALL_PIPELINE,
  TOOL_CALL_SAMPLE,
} from "./llm-tool-call-bridge-data";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type DrawSVGTweenVars = gsap.TweenVars & {
  drawSVG?: number | string;
};

type LLMToolCallBridgePanelProps = {
  onSelectDisplayIndex: (index: number) => void;
  isVisible: boolean;
};

type BridgePoint = {
  x: number;
  y: number;
};

type BridgeRoute = {
  id: string;
  kind: "branch" | "no";
  d: string;
};

type BridgeGeometry = {
  width: number;
  height: number;
  routes: BridgeRoute[];
};

const HANDOFF_ICONS = {
  system: ShieldCheck,
  user: UserRound,
  external: CircleAlert,
} as const;

const REASONING_ICONS = {
  understand: MessageSquareText,
  context: Database,
  tools: Wrench,
  arguments: KeyRound,
} as const;

function routeToCheck(
  from: BridgePoint,
  to: BridgePoint,
  trunkX: number,
): string {
  return `M ${from.x} ${from.y} H ${trunkX} V ${to.y} H ${to.x}`;
}

function routeToSandbox(
  from: BridgePoint,
  sandbox: BridgePoint,
  railX: number,
): string {
  return `M ${from.x} ${from.y} H ${railX} V ${sandbox.y} H ${sandbox.x}`;
}

export function LLMToolCallBridgePanel({
  onSelectDisplayIndex,
  isVisible,
}: LLMToolCallBridgePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [activeStageId, setActiveStageId] = useState<string>("D3");
  const [geometry, setGeometry] = useState<BridgeGeometry | null>(null);

  useLayoutEffect(() => {
    const root = innerRef.current;
    if (!root) return;

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const point = (name: string): BridgePoint | null => {
        const anchor = root.querySelector<HTMLElement>(
          `[data-bridge-anchor="${name}"]`,
        );
        if (!anchor) return null;
        const rect = anchor.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 - rootRect.left,
          y: rect.top + rect.height / 2 - rootRect.top,
        };
      };

      const perCall = point("per-call-out");
      const checkPoints = TOOL_CALL_PIPELINE.map((stage) =>
        point(`check-${stage.displayId}-in`),
      );
      const sandbox = point("sandbox-in");
      const noPoints = TOOL_CALL_PIPELINE.map((stage) =>
        point(`check-${stage.displayId}-no`),
      );
      if (
        !perCall ||
        checkPoints.some((item) => !item) ||
        !sandbox ||
        noPoints.some((item) => !item)
      ) {
        return;
      }

      const branchTargets = checkPoints as BridgePoint[];
      const firstTargetX = Math.min(...branchTargets.map((item) => item.x));
      const trunkX = perCall.x + (firstTargetX - perCall.x) / 2;
      const routes: BridgeRoute[] = branchTargets.map((target, index) => ({
        id: `per-call-check-${TOOL_CALL_PIPELINE[index]!.displayId}`,
        kind: "branch",
        d: routeToCheck(perCall, target, trunkX),
      }));

      const railX = Math.max(...(noPoints as BridgePoint[]).map((item) => item.x)) + 18;
      (noPoints as BridgePoint[]).forEach((from, index) => {
        routes.push({
          id: `no-${TOOL_CALL_PIPELINE[index]!.displayId}`,
          kind: "no",
          d: routeToSandbox(from, sandbox, railX),
        });
      });

      setGeometry({
        width: Math.max(1, rootRect.width),
        height: Math.max(1, rootRect.height),
        routes,
      });
    };

    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useGSAP(
    () => {
      const root = panelRef.current;
      if (!root || !geometry) return;

      const routes = gsap.utils.toArray<SVGPathElement>(
        ".llm-bridge-route",
        root,
      );
      const nodes = gsap.utils.toArray<HTMLElement>(
        "[data-bridge-animate]",
        root,
      );
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      gsap.killTweensOf([...routes, ...nodes]);
      if (reducedMotion || !isVisible) {
        gsap.set(routes, { drawSVG: "0% 100%" } as DrawSVGTweenVars);
        gsap.set(nodes, { autoAlpha: isVisible ? 1 : 0 });
        return;
      }

      gsap.set(routes, { drawSVG: "0% 0%" } as DrawSVGTweenVars);
      gsap.set(nodes, { autoAlpha: 0 });
      gsap.to(routes, {
        drawSVG: "0% 100%",
        duration: 0.42,
        stagger: 0.04,
        ease: LINE_DRAW_EASE,
        overwrite: "auto",
      } as DrawSVGTweenVars);
      gsap.to(nodes, {
        autoAlpha: 1,
        duration: 0.22,
        stagger: 0.028,
        delay: 0.08,
        ease: "power2.out",
        overwrite: "auto",
      });
    },
    {
      dependencies: [geometry, isVisible],
      scope: panelRef,
      revertOnUpdate: false,
    },
  );

  const selectStage = (displayIndex: number, stageId: string) => {
    setActiveStageId(stageId);
    onSelectDisplayIndex(displayIndex);
  };

  return (
    <div ref={panelRef} className="defense-detail-panel llm-tool-call-bridge-panel">
      <div className="llm-bridge-canvas" data-bridge-canvas>
        <div ref={innerRef} className="llm-bridge-canvas-inner">
          <svg
            className="llm-bridge-lines"
            viewBox={`0 0 ${geometry?.width ?? 1} ${geometry?.height ?? 1}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {geometry?.routes.map((route) => (
              <path
                key={route.id}
                className={`llm-bridge-route${route.kind === "no" ? " llm-bridge-route-no" : ""}`}
                d={route.d}
              />
            ))}
          </svg>

          <section className="llm-bridge-flow-row llm-bridge-handoff" data-bridge-animate>
            <div className="llm-bridge-stage-rail">
              <span className="llm-bridge-stage-title">D2 指令交接</span>
              <span className="llm-bridge-anchor" data-bridge-anchor="handoff-out" />
              <span className="llm-bridge-stage-arrow" aria-hidden="true">↓</span>
            </div>
            <div className="llm-bridge-row-body">
              <div className="llm-bridge-handoff-grid">
                {D2_HANDOFF_SUMMARY.map((item) => {
                  const Icon = HANDOFF_ICONS[item.id];
                  return (
                    <article key={item.id} className={`llm-bridge-handoff-item is-${item.id}`}>
                      <Icon size={20} aria-hidden="true" />
                      <strong>{item.label}</strong>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="llm-bridge-flow-row llm-bridge-reasoning" data-bridge-animate>
            <div className="llm-bridge-stage-rail">
              <span className="llm-bridge-stage-title">MODEL STEP</span>
              <span className="llm-bridge-anchor" data-bridge-anchor="reasoning-out" />
              <span className="llm-bridge-stage-arrow" aria-hidden="true">↓</span>
            </div>
            <div className="llm-bridge-row-body">
              <div className="llm-bridge-reasoning-stage">
                <div className="llm-bridge-reasoning-core">
                  <Brain size={40} strokeWidth={1.45} aria-hidden="true" />
                  <strong>LLM 推理</strong>
                </div>
                {LLM_REASONING_STEPS.map((step) => {
                  const Icon = REASONING_ICONS[step.id];
                  return (
                    <article key={step.id} className={`llm-bridge-reasoning-step is-${step.id}`}>
                      <Icon size={19} aria-hidden="true" />
                      <strong>{step.label}</strong>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="llm-bridge-flow-row llm-bridge-tool-call" data-bridge-animate>
            <div className="llm-bridge-stage-rail">
              <span className="llm-bridge-stage-title">LLM RESPONSE</span>
            </div>
            <div className="llm-bridge-row-body">
              <div className="llm-bridge-tool-call-body">
                <div className="llm-bridge-tool-call-title">
                  <Mail size={20} aria-hidden="true" />
                  <code>{TOOL_CALL_SAMPLE.functionName}</code>
                  <span className="llm-bridge-status">{TOOL_CALL_SAMPLE.status}</span>
                </div>
                <div className="llm-bridge-tool-call-fields">
                  <span><b>call_id</b><code>{TOOL_CALL_SAMPLE.callId}</code></span>
                  {Object.entries(TOOL_CALL_SAMPLE.arguments).map(([key, value]) => (
                    <span key={key}><b>{key}</b><code>{value}</code></span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="llm-bridge-flow-row llm-bridge-connector-row" data-bridge-animate aria-hidden="true">
            <div className="llm-bridge-stage-rail">
              <span className="llm-bridge-stage-arrow-long" />
            </div>
          </div>

          <section className="llm-bridge-flow-row llm-bridge-per-call" data-bridge-animate>
            <div className="llm-bridge-per-call-body">
              <span className="llm-bridge-anchor" data-bridge-anchor="per-call-out" />
              <strong>对每个 tool call</strong>
            </div>
          </section>

          <section className="llm-bridge-checks" aria-label="D3 至 D7 入 Sandbox 前防御检查">
            {TOOL_CALL_PIPELINE.map((stage) => (
              <div key={stage.displayId} className="llm-bridge-check-row" data-bridge-animate>
                <button
                  type="button"
                  className={`llm-bridge-check-stage${activeStageId === stage.displayId ? " is-active" : ""}`}
                  aria-label={`${stage.displayId} ${stage.label}，作用范围：${stage.scope}`}
                  onClick={() => selectStage(stage.displayIndex, stage.displayId)}
                >
                  <span className="llm-bridge-anchor" data-bridge-anchor={`check-${stage.displayId}-in`} />
                  <span className="llm-bridge-check-id">{stage.displayId}</span>
                  <strong>{stage.label}</strong>
                </button>
                <div className="llm-bridge-decision" aria-hidden="true">
                  <strong>blocked?</strong>
                </div>
                <div className="llm-bridge-blocked">
                  <Ban size={17} aria-hidden="true" />
                  <strong>yes → 阻断</strong>
                  <code>{stage.blockedLabel}</code>
                </div>
                <span className="llm-bridge-no-path" data-bridge-anchor={`check-${stage.displayId}-no`}>no</span>
              </div>
            ))}
          </section>

          <div className="llm-bridge-bottom" data-bridge-animate>
            <section className="llm-bridge-sandbox" aria-label="Sandbox 执行 tool call">
              <span className="llm-bridge-anchor" data-bridge-anchor="sandbox-in" />
              <div className="llm-bridge-sandbox-main">
                <CheckCircle2 size={22} aria-hidden="true" />
                <strong>Sandbox 执行 tool call</strong>
              </div>
              <button
                type="button"
                className={`llm-bridge-confirm${activeStageId === SANDBOX_CONFIRMATION.displayId ? " is-active" : ""}`}
                aria-label={`${SANDBOX_CONFIRMATION.displayId} ${SANDBOX_CONFIRMATION.label}，作用范围：${SANDBOX_CONFIRMATION.scope}`}
                onClick={() => selectStage(SANDBOX_CONFIRMATION.displayIndex, SANDBOX_CONFIRMATION.displayId)}
              >
                <LockKeyhole size={17} aria-hidden="true" />
                <strong>D8 确认门控</strong>
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
