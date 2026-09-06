"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Check, Globe2, LockKeyhole, Mail, UserRound } from "lucide-react";
import {
  D2_RULES,
  INSTRUCTION_ISOLATION_SOURCE,
} from "./d2-instruction-isolation-visualization-data";
import { usePythonSourceHighlighting } from "./usePythonSourceHighlighting";

type D2InstructionIsolationPanelProps = {
  isVisible: boolean;
};

export function D2InstructionIsolationPanel({
  isVisible,
}: D2InstructionIsolationPanelProps) {
  const [activeRule, setActiveRule] = useState(0);
  const codeRef = useRef<HTMLPreElement>(null);
  const activeLine = D2_RULES[activeRule]?.sourceLine ?? 1;
  const sourceLines = INSTRUCTION_ISOLATION_SOURCE.split(/\r?\n/);
  const highlightedLines = usePythonSourceHighlighting(INSTRUCTION_ISOLATION_SOURCE);

  useEffect(() => {
    codeRef.current
      ?.querySelector<HTMLElement>(`[data-source-line="${activeLine}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLine]);

  return (
    <div className="defense-detail-panel d2-instruction-isolation-panel">
      <section className="d2-isolation-visual" aria-label="指令隔离可视化">
        <div className="d2-flow-inputs">
          <article className="d2-flow-card is-trusted">
            <span className="d2-flow-card-icon"><UserRound size={16} aria-hidden="true" /></span>
            <div><strong>用户消息</strong><small>可信指令来源</small></div>
          </article>
          <article className="d2-flow-card is-untrusted">
            <span className="d2-flow-card-icon"><Globe2 size={16} aria-hidden="true" /></span>
            <div><strong>网页 / 邮件内容</strong><small>不可信数据</small></div>
          </article>
        </div>
        <div className="d2-flow-connectors" aria-hidden="true">
          <span /><span />
        </div>
        <article className="d2-prompt-boundary">
          <LockKeyhole size={18} aria-hidden="true" />
          <div>
            <strong>build_system_prompt(defended=True)</strong>
            <code>DEFENDED_SYSTEM_PROMPT</code>
          </div>
          <span className="d2-boundary-badge">保护边界</span>
        </article>
        <div className="d2-flow-outcomes">
          <article className="d2-outcome is-allowed">
            <Check size={16} aria-hidden="true" />
            <div><strong>用户直接请求</strong><small>允许作为意图判断输入</small></div>
          </article>
          <article className="d2-outcome is-blocked">
            <Ban size={16} aria-hidden="true" />
            <div><strong>页面内指令</strong><small>不可执行 / ignored</small></div>
          </article>
        </div>
        <div className="d2-isolation-caption">
          <span>网页内容是数据，不是指令：禁止转发、发送、覆盖、系统更新</span>
          <span>仅用户指令可驱动 tool call</span>
        </div>
        <div className="d2-implicit-context" aria-label="隐含保护上下文">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>受保护上下文 · system prompt 约束隐含在模型上下文中</span>
          <span className="d2-redacted-mark">不可直接见</span>
        </div>
      </section>

      <div className="defense-detail-lower d2-detail-lower">
        <section className="defense-source-viewer d2-source-viewer" aria-label="prompts.py 源码快照">
          <header><span>prompts.py</span><span>源码快照</span></header>
          <pre ref={codeRef}><code>{sourceLines.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <span key={lineNumber} data-source-line={lineNumber} className={lineNumber === activeLine ? "is-active" : ""}>
                <span className="d1-source-line-number">{lineNumber}</span>
                <span dangerouslySetInnerHTML={{ __html: highlightedLines?.[index] ?? (line || " ") }} />
              </span>
            );
          })}</code></pre>
        </section>
        <section className="d2-rule-viewer" aria-label="指令隔离规则">
          <header><span>隔离规则</span><span>DEFENDED_SYSTEM_PROMPT</span></header>
          <ol>
            {D2_RULES.map((rule, index) => (
              <li key={rule.id} className={index === activeRule ? "is-active" : ""}>
                <button type="button" onClick={() => setActiveRule(index)} aria-pressed={index === activeRule} aria-label={`${rule.label}：${rule.detail}`}>
                  <span>{rule.id}</span><span><strong>{rule.label}</strong><small>{rule.detail}</small></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="d2-rule-footer"><Mail size={13} aria-hidden="true" /> email.send 确认限制保留到 Sandbox 阶段</div>
        </section>
      </div>
      <span className="sr-only">{isVisible ? "D2 指令隔离已显示" : "D2 指令隔离未显示"}</span>
    </div>
  );
}
