"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Ban, Check, CircleDot, Mail, MemoryStick, ShieldAlert } from "lucide-react";
import { D3D8DetailShell } from "./D3D8DetailShell";
import { D7_RULES, OUTPUT_FILTER_SOURCE, type D7AuditStepId } from "./d3-d8-defense-visualization-data";

type Props = { isVisible: boolean };

type AuditStep = { id: D7AuditStepId; label: string };
const emailSteps: readonly AuditStep[] = [
  { id: "recipient-risk", label: "检查收件人风险" },
  { id: "recipient-source", label: "检查收件人来源" },
  { id: "body-source", label: "检查正文来源" },
  { id: "subject-source", label: "检查主题来源" },
];
const memorySteps: readonly AuditStep[] = [
  { id: "memory-source", label: "检查记忆值来源" },
  { id: "memory-content", label: "检查键值内容风险" },
];

export function D7OutputFilterPanel({ isVisible }: Props) {
  const [selectedRuleId, setSelectedRuleId] = useState(D7_RULES[0]!.id);
  const rule = D7_RULES.find((item) => item.id === selectedRuleId) ?? D7_RULES[0]!;

  useEffect(() => {
    if (isVisible) setSelectedRuleId(D7_RULES[0]!.id);
  }, [isVisible]);

  const steps = rule.toolName === "email.send" ? emailSteps : memorySteps;
  const activeIndex = rule.activeStep === "complete" ? steps.length : steps.findIndex((step) => step.id === rule.activeStep);

  return (
    <D3D8DetailShell
      className="d7-output-panel"
      visual={
        <div className="d7-output-visual" aria-label="输出过滤顺序审查流程">
          <article className="d7-call-payload">
            <span>{rule.toolName === "email.send" ? <Mail size={19} aria-hidden="true" /> : <MemoryStick size={19} aria-hidden="true" />}</span>
            <div><strong>待审工具调用</strong><code>{rule.toolName}</code></div>
            <dl>{rule.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
          </article>
          <ArrowRight className="d7-flow-arrow" size={23} aria-hidden="true" />
          <div className="d7-audit-sequence">
            {steps.map((step, index) => {
              const isSkipped = rule.skippedSteps.includes(step.id);
              const status = isSkipped ? "skipped" : index < activeIndex || rule.outcome === "allowed" ? "passed" : index === activeIndex ? "blocked" : "pending";
              return (
                <div key={step.id} className={`d7-audit-step is-${status}`}>
                  <span>{status === "passed" ? <Check size={15} aria-hidden="true" /> : status === "blocked" ? <ShieldAlert size={15} aria-hidden="true" /> : <CircleDot size={15} aria-hidden="true" />}</span>
                  <strong>{step.label}</strong>
                  <small>{status === "skipped" ? "未执行" : status === "passed" ? "通过" : status === "blocked" ? "命中风险" : "等待"}</small>
                </div>
              );
            })}
          </div>
          <ArrowRight className="d7-flow-arrow" size={23} aria-hidden="true" />
          <div className={`d7-flow-terminal is-${rule.outcome}`}>
            {rule.outcome === "blocked" ? <Ban size={26} aria-hidden="true" /> : <Check size={26} aria-hidden="true" />}
            <strong>{rule.outcome === "blocked" ? "拦截" : "放行"}</strong>
            <small>{rule.outcome === "blocked" ? "停止后续审查" : "进入 Sandbox"}</small>
          </div>
        </div>
      }
      sources={[OUTPUT_FILTER_SOURCE]}
      activeLine={rule.sourceLine}
      rules={D7_RULES}
      selectedRuleId={selectedRuleId}
      onRuleSelect={(nextRule) => setSelectedRuleId(nextRule.id)}
    />
  );
}
