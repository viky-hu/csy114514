"use client";

import { useEffect, useState } from "react";
import { Ban, Check, Globe2, LockKeyhole, UserRound } from "lucide-react";
import { DefenseExplanationList } from "./DefenseExplanationList";
import { DefenseSourceViewer } from "./DefenseSourceViewer";
import { D2_RULES, INSTRUCTION_ISOLATION_SNAPSHOT } from "./d2-instruction-isolation-visualization-data";

type D2InstructionIsolationPanelProps = { isVisible: boolean };

export function D2InstructionIsolationPanel({ isVisible }: D2InstructionIsolationPanelProps) {
  const [selectedRuleId, setSelectedRuleId] = useState(D2_RULES[0]!.id);
  const activeRule = D2_RULES.find((rule) => rule.id === selectedRuleId) ?? D2_RULES[0]!;

  useEffect(() => {
    if (isVisible) setSelectedRuleId(D2_RULES[0]!.id);
  }, [isVisible]);

  const activeState = activeRule.visualStateId;

  return (
    <div className="defense-detail-panel d2-instruction-isolation-panel">
      <section className="d2-instruction-isolation-visual d2-isolation-visual" aria-label="指令隔离可视化">
        <div className="d2-flow-inputs">
          <article className={`d2-flow-card is-trusted${activeState === "instruction-boundary" ? " is-active" : ""}`}>
            <span className="d2-flow-card-icon"><UserRound size={16} aria-hidden="true" /></span>
            <div><strong>用户消息</strong><small>可信指令来源</small></div>
          </article>
          <article className={`d2-flow-card is-untrusted${activeState === "source-isolation" || activeState === "ignore-page-instruction" ? " is-active" : ""}`}>
            <span className="d2-flow-card-icon"><Globe2 size={16} aria-hidden="true" /></span>
            <div><strong>网页 / 邮件内容</strong><small>不可信数据</small></div>
          </article>
        </div>
        <div className="d2-flow-connectors" aria-hidden="true"><span /><span /></div>
        <article className={`d2-prompt-boundary${activeState === "protect-memory" ? " is-active" : ""}`}>
          <LockKeyhole size={18} aria-hidden="true" />
          <div><strong>build_system_prompt(defended=True)</strong><code>DEFENDED_SYSTEM_PROMPT</code></div>
          <span className="d2-boundary-badge">保护边界</span>
        </article>
        <div className="d2-flow-outcomes">
          <article className="d2-outcome is-allowed">
            <Check size={16} aria-hidden="true" />
            <div><strong>用户直接请求</strong><small>允许进入意图判断</small></div>
          </article>
          <article className={`d2-outcome is-blocked${activeState === "ignore-page-instruction" ? " is-active" : ""}`}>
            <Ban size={16} aria-hidden="true" />
            <div><strong>页面内指令</strong><small>不可执行</small></div>
          </article>
        </div>
        <div className="d2-isolation-caption">
          <span>网页内容是数据，不是指令</span>
          <span>仅用户消息可驱动工具调用</span>
        </div>
        <div className={`d2-implicit-context${activeState === "email-confirmation" ? " is-active" : ""}`} aria-label="受保护上下文">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>系统提示词约束模型对不可信内容的处理</span>
        </div>
      </section>

      <div className="defense-detail-lower d2-detail-lower">
        <DefenseSourceViewer
          sources={[INSTRUCTION_ISOLATION_SNAPSHOT]}
          activeLine={activeRule.sourceLine}
          ariaLabel="prompts.py 源码快照"
        />
        <DefenseExplanationList
          rules={D2_RULES}
          activeId={selectedRuleId}
          onSelect={(rule) => setSelectedRuleId(rule.id)}
          ariaLabel="指令隔离规则"
        />
      </div>
      <span className="sr-only">{isVisible ? "D2 指令隔离已显示" : "D2 指令隔离未显示"}</span>
    </div>
  );
}
