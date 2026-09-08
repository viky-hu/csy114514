"use client";

import { useEffect, useState } from "react";
import { Check, Combine, KeyRound, ScanSearch, ShieldAlert, X } from "lucide-react";
import { D3D8DetailShell } from "./D3D8DetailShell";
import { D5_RULES, MEMORY_AUDITOR_SOURCE } from "./d3-d8-defense-visualization-data";

type Props = { isVisible: boolean };

const stages = [
  { label: "合并键值", detail: "统一小写", icon: Combine },
  { label: "可疑模式扫描", detail: "逐项匹配", icon: ScanSearch },
  { label: "高风险键判断", detail: "决定是否复核", icon: KeyRound },
  { label: "二次条件复核", detail: "长度、邮箱、网址", icon: ShieldAlert },
] as const;

export function D5MemoryAuditorPanel({ isVisible }: Props) {
  const [selectedRuleId, setSelectedRuleId] = useState(D5_RULES[0]!.id);
  const rule = D5_RULES.find((item) => item.id === selectedRuleId) ?? D5_RULES[0]!;

  useEffect(() => {
    if (isVisible) setSelectedRuleId(D5_RULES[0]!.id);
  }, [isVisible]);

  return (
    <D3D8DetailShell
      className="d5-memory-panel"
      visual={
        <div className="d5-memory-visual" aria-label="记忆写入审计流程">
          <div className="d5-audit-flow">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const state = index < rule.activeStep ? "is-complete" : index === rule.activeStep ? "is-active" : "";
              return (
                <div key={stage.label} className={`d5-audit-stage ${state}`}>
                  <span><Icon size={19} aria-hidden="true" /></span>
                  <strong>{stage.label}</strong>
                  <small>{stage.detail}</small>
                  {index < stages.length - 1 ? <i aria-hidden="true" /> : null}
                </div>
              );
            })}
            <div className={`d5-audit-result is-${rule.outcome}`}>
              {rule.outcome === "blocked" ? <X size={22} aria-hidden="true" /> : <Check size={22} aria-hidden="true" />}
              <strong>{rule.outcome === "blocked" ? "阻断写入" : rule.outcome === "allowed" ? "允许写入" : "等待结论"}</strong>
              <small>{rule.outcome === "review" ? "继续执行后续检查" : "审计流程结束"}</small>
            </div>
          </div>
        </div>
      }
      sources={[MEMORY_AUDITOR_SOURCE]}
      activeLine={rule.sourceLine}
      rules={D5_RULES}
      selectedRuleId={selectedRuleId}
      onRuleSelect={(nextRule) => setSelectedRuleId(nextRule.id)}
    />
  );
}
