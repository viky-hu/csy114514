"use client";

import { useEffect, useState } from "react";
import { Scale, ShieldAlert, UserRound } from "lucide-react";
import { D3D8DetailShell } from "./D3D8DetailShell";
import { D4_RULES, INTENT_CLASSIFIER_SOURCE } from "./d3-d8-defense-visualization-data";

type Props = { isVisible: boolean };

export function D4IntentClassifierPanel({ isVisible }: Props) {
  const [selectedRuleId, setSelectedRuleId] = useState(D4_RULES[0]!.id);
  const rule = D4_RULES.find((item) => item.id === selectedRuleId) ?? D4_RULES[0]!;

  useEffect(() => {
    if (isVisible) setSelectedRuleId(D4_RULES[0]!.id);
  }, [isVisible]);

  const resultLabel = rule.result === "user_intent" ? "用户意图" : "页面指令";

  return (
    <D3D8DetailShell
      className="d4-intent-panel"
      visual={
        <div className="d4-intent-visual" aria-label="双证据天平">
          <div className="d4-balance">
            <article className={`d4-evidence is-user${rule.visualStateId.includes("user") ? " is-active" : ""}`}>
              <UserRound size={20} aria-hidden="true" />
              <span>用户输入证据</span>
              <strong>{rule.userScore}</strong>
              <small>{rule.userEvidence.join("、") || "当前没有用户侧命中"}</small>
            </article>
            <div className="d4-balance-center">
              <Scale size={35} aria-hidden="true" />
              <strong>{resultLabel}</strong>
              <code>{rule.result}</code>
              <span>置信度 {rule.confidence.toFixed(1)}</span>
              <div className="d4-threshold-scale" aria-label="分类阈值">
                <i className={rule.visualStateId === "page-threshold" ? "is-active" : ""}><b>0.6</b><span>页面阻断</span></i>
                <i className={rule.visualStateId === "user-threshold" ? "is-active" : ""}><b>0.7</b><span>用户确认</span></i>
              </div>
            </div>
            <article className={`d4-evidence is-page${rule.visualStateId.includes("page") ? " is-active" : ""}`}>
              <ShieldAlert size={20} aria-hidden="true" />
              <span>页面与参数证据</span>
              <strong>{rule.pageScore}</strong>
              <small>{rule.pageEvidence.join("、") || "当前没有页面侧命中"}</small>
            </article>
          </div>
        </div>
      }
      sources={[INTENT_CLASSIFIER_SOURCE]}
      activeLine={rule.sourceLine}
      rules={D4_RULES}
      selectedRuleId={selectedRuleId}
      onRuleSelect={(nextRule) => setSelectedRuleId(nextRule.id)}
    />
  );
}
