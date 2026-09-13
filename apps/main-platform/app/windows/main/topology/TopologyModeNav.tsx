"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import type { AgentTopology, TopologyType } from "./topology-types";

gsap.registerPlugin(useGSAP);

type TopologyModeNavProps = {
  dialogClosing: boolean;
  errorMessage: string | null;
  isExpanded: boolean;
  isSwitching: boolean;
  pendingTopologyType: TopologyType | null;
  topology: AgentTopology;
  onConfirmChange: () => void;
  onDismissChange: () => void;
  onOpenChange: (nextOpen: boolean) => void;
  onRequestChange: (topologyType: TopologyType) => void;
};

type ModeDefinition = {
  description: string;
  label: string;
  topologyType: TopologyType;
};

const MODE_DEFINITIONS: ModeDefinition[] = [
  {
    description: "单一智能体直接连接工具，保留当前标准安全评估路径。",
    label: "Single Agent 模式",
    topologyType: "single",
  },
  {
    description: "规划与执行职责分离，清晰呈现任务交接与工具边界。",
    label: "Planner–Executor 模式",
    topologyType: "planner_executor",
  },
  {
    description: "连接知识库与检索链路，展示外部内容进入 Agent 的风险路径。",
    label: "RAG Agent 模式",
    topologyType: "rag_agent",
  },
];

function getModeDefinition(topologyType: TopologyType) {
  return MODE_DEFINITIONS.find((mode) => mode.topologyType === topologyType) ?? MODE_DEFINITIONS[0];
}

function TopologyMark({ topologyType }: { topologyType: TopologyType }) {
  if (topologyType === "planner_executor") {
    return <svg aria-hidden="true" className="topology-mode-nav-mark" viewBox="0 0 34 26"><circle cx="7" cy="13" r="4" /><path d="M12 13h10" /><path d="m19 8 5 5-5 5" /><rect x="25" y="8" width="7" height="10" rx="1" /></svg>;
  }

  if (topologyType === "rag_agent") {
    return <svg aria-hidden="true" className="topology-mode-nav-mark" viewBox="0 0 34 26"><rect x="1" y="7" width="8" height="12" rx="1" /><path d="M10 13h6" /><circle cx="19" cy="13" r="4" /><path d="M23 13h5" /><path d="m25 8 5 5-5 5" /></svg>;
  }

  return <svg aria-hidden="true" className="topology-mode-nav-mark" viewBox="0 0 34 26"><circle cx="8" cy="13" r="5" /><path d="M14 13h9" /><rect x="24" y="8" width="8" height="10" rx="1" /></svg>;
}

export function TopologyModeNav({
  dialogClosing,
  errorMessage,
  isExpanded,
  isSwitching,
  pendingTopologyType,
  topology,
  onConfirmChange,
  onDismissChange,
  onOpenChange,
  onRequestChange,
}: TopologyModeNavProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const activeMode = getModeDefinition(topology.topology_type);
  const pendingMode = pendingTopologyType ? getModeDefinition(pendingTopologyType) : null;

  useGSAP(
    () => {
      if (!isExpanded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const cards = rootRef.current?.querySelectorAll<HTMLElement>(".topology-mode-nav-card");
      if (!cards?.length) {
        return;
      }

      gsap.fromTo(cards, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, duration: 0.28, ease: "power3.out", stagger: 0.06, y: 0 });
    },
    { dependencies: [isExpanded], revertOnUpdate: true, scope: rootRef },
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!pendingTopologyType && !isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSwitching) {
        event.preventDefault();
        if (pendingTopologyType) {
          onDismissChange();
        } else {
          onOpenChange(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, isSwitching, onDismissChange, onOpenChange, pendingTopologyType]);

  return (
    <div ref={rootRef} className="topology-mode-nav">
      <nav aria-label="Agent 拓扑模式" className={`topology-mode-nav-shell${isExpanded ? " is-expanded" : ""}`}>
        <div className="topology-mode-nav-head">
          <span className="topology-mode-nav-current"><TopologyMark topologyType={topology.topology_type} /><span>{activeMode.label}</span></span>
          <button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "收起拓扑模式菜单" : "打开拓扑模式菜单"}
            className={`topology-mode-nav-toggle${isExpanded ? " is-expanded" : ""}`}
            onClick={() => onOpenChange(!isExpanded)}
            type="button"
          >
            <span /><span />
          </button>
        </div>
        <div aria-hidden={!isExpanded} className="topology-mode-nav-cards">
          {MODE_DEFINITIONS.map((mode) => {
            const isCurrent = mode.topologyType === topology.topology_type;
            return (
              <button
                key={mode.topologyType}
                aria-current={isCurrent ? "true" : undefined}
                className={`topology-mode-nav-card is-${mode.topologyType.replace("_", "-")}${isCurrent ? " is-current" : ""}`}
                disabled={isCurrent}
                onClick={() => onRequestChange(mode.topologyType)}
                tabIndex={isExpanded ? 0 : -1}
                type="button"
              >
                <TopologyMark topologyType={mode.topologyType} />
                <strong>{mode.label.replace(" 模式", "")}</strong>
                <span>{mode.description}</span>
                {isCurrent ? <em>当前模式</em> : null}
              </button>
            );
          })}
        </div>
      </nav>

      {isMounted && pendingMode ? createPortal(
        <div
          aria-hidden={dialogClosing}
          className={`topology-mode-nav-dialog-layer${dialogClosing ? " is-closing" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSwitching) {
              onDismissChange();
            }
          }}
        >
          <section aria-describedby="topology-mode-nav-dialog-copy" aria-labelledby="topology-mode-nav-dialog-title" aria-modal="true" className="topology-mode-nav-dialog" role="dialog">
            <h2 id="topology-mode-nav-dialog-title">切换至 {pendingMode.label}？</h2>
            <p id="topology-mode-nav-dialog-copy">将应用当前 Agent 配置并切换拓扑模式。确认后会重新加载总览中的拓扑内容。</p>
            {errorMessage ? <p className="topology-mode-nav-dialog-error" role="alert">{errorMessage}</p> : null}
            <div className="topology-mode-nav-dialog-actions">
              <button disabled={isSwitching} onClick={onConfirmChange} type="button">{isSwitching ? "正在切换" : "确认切换"}</button>
              <button disabled={isSwitching} onClick={onDismissChange} type="button">稍后再说</button>
            </div>
          </section>
        </div>
        , document.body) : null}
    </div>
  );
}
