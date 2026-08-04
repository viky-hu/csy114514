"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  Activity,
  DatabaseZap,
  FileText,
  Fingerprint,
  Network,
} from "lucide-react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { overviewFixtureViewModel } from "./overview-fixtures";
import { OverviewR4Graph } from "./OverviewR4Graph";

gsap.registerPlugin(useGSAP);

type OverviewDashboardProps = {
  onNavigate: (key: OverviewNavKey) => void;
};

type OverviewNavKey = "anatomy" | "profile" | "report" | "run";

const RISK_TYPE_LABELS: Record<string, string> = {
  indirect_prompt_injection: "间接提示注入",
  persistent_indirect_prompt_injection: "持久性间接提示注入",
};

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "严重",
  HIGH: "高危",
  LOW: "低危",
  MEDIUM: "中危",
};

const DATA_SOURCE_LABELS: Record<string, string> = {
  browser: "浏览器",
  email: "邮件",
  memory: "记忆",
};

const MEMORY_TYPE_LABELS: Record<string, string> = {
  persistent: "持久记忆",
};

function formatRiskType(riskType: string) {
  return RISK_TYPE_LABELS[riskType] ?? riskType.replaceAll("_", " ");
}

function formatSeverity(severity: string) {
  return SEVERITY_LABELS[severity] ?? severity;
}

function formatDataSources(dataSources: string[]) {
  return dataSources
    .map((source) => DATA_SOURCE_LABELS[source] ?? source)
    .join(" / ");
}

function formatMemoryType(memoryType: string) {
  return MEMORY_TYPE_LABELS[memoryType] ?? memoryType;
}

function formatConclusion(conclusion: string) {
  if (conclusion.includes("persistent indirect prompt injection")) {
    return "发现严重风险：CorpMate v0 可经由记忆系统受到持久性间接提示注入影响。上线前需要补齐记忆隔离与工具调用确认门。";
  }

  return conclusion;
}

function formatFindingDescription(description: string) {
  if (description.includes("Full PIPI chain")) {
    return "完整 R4 链路已成立：不可信网页内容进入智能体，被写入持久记忆，随后再次触发邮件发送。";
  }

  return description;
}

function formatEvidenceDescription(eventId: string, description: string) {
  if (eventId === "evt-003") {
    return "不可信网页内容被写入 memory.write，污染进入持久记忆。";
  }

  if (eventId === "evt-007") {
    return "读取被污染记忆后触发 email.send，风险完成外发动作。";
  }

  return description;
}

function isOverviewNavKey(key: string): key is OverviewNavKey {
  return key === "anatomy" || key === "profile" || key === "report" || key === "run";
}

export function OverviewDashboard({ onNavigate }: OverviewDashboardProps) {
  const viewModel = overviewFixtureViewModel;
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const sections = gsap.utils.toArray<HTMLElement>(".overview-animate", root);

      if (prefersReducedMotion) {
        gsap.set(sections, { autoAlpha: 1, y: 0 });
        return;
      }

      gsap.set(sections, { autoAlpha: 0, y: 14 });

      const timeline = gsap.timeline({
        defaults: { ease: LINE_DRAW_EASE },
      });

      timeline.to(sections, {
        autoAlpha: 1,
        duration: 0.56,
        stagger: 0.06,
        y: 0,
      });

      return () => {
        timeline.kill();
        gsap.killTweensOf(sections);
      };
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} className="overview-dashboard" aria-label="总览页">
      <header className="overview-brief overview-animate">
        <div className="overview-brief-copy">
          <span className="overview-kicker">CorpMate v0 示例评估</span>
          <h1>R4 持久性间接提示注入已形成完整攻击链</h1>
          <p>{formatConclusion(viewModel.risk.conclusion)}</p>
        </div>
        <div
          className="overview-score"
          aria-label={`总体评分 ${viewModel.risk.score}`}
        >
          <span className="overview-score-label">总体评分</span>
          <strong>{viewModel.risk.score.toFixed(0)}</strong>
          <span className="overview-severity">
            {formatSeverity(viewModel.risk.severity)}
          </span>
        </div>
      </header>

      <div className="overview-grid">
        <section className="overview-map overview-animate" aria-label="R4 攻击链">
          <div className="overview-section-heading">
            <div>
              <span className="overview-kicker">R4 攻击路径</span>
            </div>
          </div>

          <OverviewR4Graph nodes={viewModel.attackChain} />

          <div className="overview-map-footer">
            <p className="overview-path-caption">
              {formatFindingDescription(viewModel.r4Finding.description)}
            </p>
            <button
              className="overview-icon-command"
              onClick={() => onNavigate("anatomy")}
              type="button"
            >
              <Network size={17} aria-hidden="true" />
              <span>进入攻击图谱</span>
            </button>
          </div>
        </section>

        <aside className="overview-side-stack">
          <section className="overview-risk-panel overview-animate" aria-label="风险摘要">
            <div className="overview-section-heading is-compact">
              <div>
                <span className="overview-kicker">风险类型</span>
                <h2>{formatRiskType(viewModel.r4Finding.riskType)}</h2>
              </div>
              <span className="overview-pattern-id">
                {viewModel.r4Finding.riskPatternId}
              </span>
            </div>
            <div className="overview-risk-metrics">
              <div>
                <strong>{viewModel.risk.totalFindings}</strong>
                <span>发现项</span>
              </div>
              <div>
                <strong>{viewModel.risk.severityCounts.CRITICAL}</strong>
                <span>严重</span>
              </div>
              <div>
                <strong>{viewModel.risk.severityCounts.HIGH}</strong>
                <span>高危</span>
              </div>
            </div>
          </section>

          <section className="overview-evidence-panel overview-animate" aria-label="证据摘要">
            <div className="overview-section-heading is-compact">
              <div>
                <span className="overview-kicker">证据链</span>
                <h2>关键证据</h2>
              </div>
              <button
                className="overview-mini-command"
                onClick={() => onNavigate("report")}
                type="button"
              >
                <FileText size={15} aria-hidden="true" />
                <span>报告</span>
              </button>
            </div>
            <ol className="overview-evidence-list">
              {viewModel.r4Finding.evidence.map((item) => (
                <li key={item.eventId}>
                  <span>{item.eventId}</span>
                  <p>{formatEvidenceDescription(item.eventId, item.description)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="overview-agent-panel overview-animate" aria-label="智能体风险侧写">
            <div className="overview-section-heading is-compact">
              <div>
                <span className="overview-kicker">智能体侧写</span>
                <h2>{viewModel.agent.name}</h2>
              </div>
              <button
                className="overview-mini-command"
                onClick={() => onNavigate("profile")}
                type="button"
              >
                <Fingerprint size={15} aria-hidden="true" />
                <span>画像</span>
              </button>
            </div>
            <div className="overview-agent-facts">
              <span>
                <Activity size={14} aria-hidden="true" />
                {viewModel.agent.toolCount} 项工具
              </span>
              <span>
                <DatabaseZap size={14} aria-hidden="true" />
                {formatMemoryType(viewModel.agent.memoryType)}
              </span>
              <span>{formatDataSources(viewModel.agent.dataSources)}</span>
              <span>{viewModel.agent.confirmedToolName} 需确认</span>
            </div>
          </section>
        </aside>
      </div>

      <footer className="overview-process overview-animate" aria-label="评估闭环">
        {viewModel.process.map((stage, index) => (
          <button
            key={stage.key}
            className={`overview-process-step is-${stage.status}`}
            onClick={() => {
              if (isOverviewNavKey(stage.key)) {
                onNavigate(stage.key);
              }
            }}
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{stage.label}</strong>
            <em>{stage.english}</em>
          </button>
        ))}
      </footer>
    </section>
  );
}
