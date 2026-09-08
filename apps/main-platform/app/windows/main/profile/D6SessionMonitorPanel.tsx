"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleAlert, Database, Mail, RefreshCw } from "lucide-react";
import { D3D8DetailShell } from "./D3D8DetailShell";
import { D6_RULES, SESSION_MONITOR_SOURCE } from "./d3-d8-defense-visualization-data";

type Props = { isVisible: boolean };

export function D6SessionMonitorPanel({ isVisible }: Props) {
  const [selectedRuleId, setSelectedRuleId] = useState(D6_RULES[0]!.id);
  const rule = D6_RULES.find((item) => item.id === selectedRuleId) ?? D6_RULES[0]!;

  useEffect(() => {
    if (isVisible) setSelectedRuleId(D6_RULES[0]!.id);
  }, [isVisible]);

  return (
    <D3D8DetailShell
      className="d6-session-panel"
      visual={
        <div className="d6-session-visual" aria-label="双会话泳道">
          <div className="d6-lanes">
            <article className="d6-lane">
              <strong>会话 N</strong>
              {rule.sessionOne.map((step) => <span key={step}><Database size={14} aria-hidden="true" />{step}</span>)}
            </article>
            <div className="d6-boundary">
              <RefreshCw size={20} aria-hidden="true" />
              <strong>会话边界</strong>
              <small>{rule.boundary}</small>
            </div>
            <article className="d6-lane is-next">
              <strong>会话 N+1</strong>
              {rule.sessionTwo.map((step) => <span key={step}>{step.includes("email") ? <Mail size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}{step}</span>)}
            </article>
            <div className={`d6-lane-result is-${rule.resultTone}`}>
              {rule.resultTone === "blocked" ? <CircleAlert size={21} aria-hidden="true" /> : <Check size={21} aria-hidden="true" />}
              <strong>{rule.result}</strong>
              <small>{rule.resultTone === "blocked" ? "会话监控产生告警" : "继续观察后续调用"}</small>
            </div>
          </div>
        </div>
      }
      sources={[SESSION_MONITOR_SOURCE]}
      activeLine={rule.sourceLine}
      rules={D6_RULES}
      selectedRuleId={selectedRuleId}
      onRuleSelect={(nextRule) => setSelectedRuleId(nextRule.id)}
    />
  );
}
