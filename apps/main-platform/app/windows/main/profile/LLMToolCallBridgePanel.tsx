"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, CheckCircle2, ChevronDown, GitBranch, LockKeyhole, Sparkles } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { LINE_DRAW_EASE } from "../../shared/animation";
import {
  TOOL_CALL_BRIDGE_SOURCE,
  TOOL_CALL_BRIDGE_TITLE,
  TOOL_CALL_PIPELINE,
} from "./llm-tool-call-bridge-data";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type DrawSVGTweenVars = gsap.TweenVars & {
  drawSVG?: number | string;
};

type LLMToolCallBridgePanelProps = {
  onSelectDisplayIndex: (index: number) => void;
  isVisible: boolean;
};

export function LLMToolCallBridgePanel({ onSelectDisplayIndex, isVisible }: LLMToolCallBridgePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeStageId, setActiveStageId] = useState("D5");
  const sourceRef = useRef<HTMLPreElement>(null);
  useGSAP(() => {
    const root = panelRef.current;
    if (!root) return;
    const paths = gsap.utils.toArray<SVGPathElement>(".llm-bridge-path", root);
    const nodes = gsap.utils.toArray<HTMLElement>("[data-bridge-stage]", root);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf([...paths, ...nodes]);
    if (reducedMotion || !isVisible) {
      gsap.set(paths, { drawSVG: "0% 100%" } as DrawSVGTweenVars);
      gsap.set(nodes, { autoAlpha: isVisible ? 1 : 0 });
      return;
    }
    gsap.set(paths, { drawSVG: "0% 0%" } as DrawSVGTweenVars);
    gsap.to(paths, {
      drawSVG: "0% 100%",
      duration: 0.48,
      stagger: 0.035,
      ease: LINE_DRAW_EASE,
      overwrite: "auto",
    } as DrawSVGTweenVars);
    gsap.fromTo(nodes, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.03, ease: "power2.out", overwrite: "auto" });
  }, { dependencies: [isVisible], scope: panelRef, revertOnUpdate: false });

  const branchStages = TOOL_CALL_PIPELINE.filter(
    (stage) => stage.displayIndex !== null && stage.id !== "D3",
  );
  const confirmationStage = TOOL_CALL_PIPELINE.find(
    (stage) => stage.id === "D3",
  )!;
  const activeStage =
    TOOL_CALL_PIPELINE.find((stage) => stage.id === activeStageId) ??
    TOOL_CALL_PIPELINE[0]!;
  const selectStage = (stage: (typeof TOOL_CALL_PIPELINE)[number]) => {
    setActiveStageId(stage.id);
    if (stage.displayIndex !== null) {
      onSelectDisplayIndex(stage.displayIndex);
    }
  };

  useEffect(() => {
    sourceRef.current
      ?.querySelector<HTMLElement>(`[data-source-line="${activeStage.sourceLine}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeStage.sourceLine]);
  return (
    <div ref={panelRef} className="defense-detail-panel llm-tool-call-bridge-panel">
      <section className="llm-bridge-visual" aria-label="LLM 推理到 tool calls 防御流水线">
        <div className="llm-bridge-heading"><Sparkles size={16} aria-hidden="true" /><strong>LLM 推理</strong><span>→</span><strong>返回 tool calls</strong><small>{TOOL_CALL_BRIDGE_TITLE} · 每一个 tool call 进入共同防御流水线</small></div>
        <svg className="llm-bridge-lines" viewBox="0 0 1000 190" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="llm-bridge-path" d="M 88 28 H 912" />
          <path className="llm-bridge-path" d="M 166 28 V 90 H 834 V 28" />
          <path className="llm-bridge-path" d="M 500 90 V 169" />
        </svg>
        <div className="llm-bridge-stages">
          {branchStages.map((stage) => (
            <button key={stage.id} type="button" data-bridge-stage={stage.id} className={`llm-bridge-stage ${stage.id === activeStage.id ? "is-active" : ""}`} onClick={() => selectStage(stage)} aria-label={`${stage.id} ${stage.label}，作用范围：${stage.scope}`}>
              <span className="llm-bridge-stage-id">{stage.id}</span><strong>{stage.label}</strong><small>{stage.scope}</small><em><Ban size={11} aria-hidden="true" /> {stage.blocked}</em>
            </button>
          ))}
        </div>
        <div className="llm-bridge-sandbox" data-bridge-stage="SANDBOX"><CheckCircle2 size={15} aria-hidden="true" /><strong>Sandbox 执行</strong><span>允许路径</span><ChevronDown size={14} aria-hidden="true" /></div>
        <button type="button" data-bridge-stage="D3" className="llm-bridge-confirm-note" onClick={() => selectStage(confirmationStage)} aria-label="D3 确认门控，作用范围：Sandbox 内 email.send"><LockKeyhole size={13} aria-hidden="true" /> D3 确认门控只在 Sandbox 内处理 email.send</button>
      </section>
      <div className="defense-detail-lower llm-bridge-lower">
        <section className="defense-source-viewer bridge-source-viewer" aria-label="defended_llm_agent.py 源码快照">
          <header><span>defended_llm_agent.py</span><span>源码快照</span></header>
          <pre ref={sourceRef}><code>{TOOL_CALL_BRIDGE_SOURCE.split("\n").map((line, index) => {
            const lineNumber = index + 1;
            return <span key={lineNumber} data-source-line={lineNumber} className={lineNumber === activeStage.sourceLine ? "is-active" : ""}><i>{lineNumber}</i><b>{line}</b></span>;
          })}</code></pre>
        </section>
        <section className="bridge-explanation" aria-label="工具调用执行顺序">
          <header><span>执行顺序</span><span>串行 + 条件分支</span></header>
          <ol>{TOOL_CALL_PIPELINE.map((stage) => <li key={stage.id} className={stage.id === activeStage.id ? "is-active" : ""}><button type="button" onClick={() => selectStage(stage)} aria-label={`${stage.id} ${stage.label}，${stage.scope}`}><span>{stage.id}</span><span><strong>{stage.label}</strong><small>{stage.scope}{stage.blocked ? ` · ${stage.blocked}` : ""}</small></span></button></li>)}</ol>
          <div className="bridge-flow-legend"><GitBranch size={13} aria-hidden="true" /> 共同顺序固定；只有适用工具类型触发对应条件分支</div>
        </section>
      </div>
    </div>
  );
}
