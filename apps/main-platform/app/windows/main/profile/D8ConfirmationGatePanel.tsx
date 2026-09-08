"use client";

import { useEffect, useState } from "react";
import { Ban, Clock3, LockKeyhole, Play, UserCheck } from "lucide-react";
import { D3D8DetailShell } from "./D3D8DetailShell";
import { COMPOSITE_SANDBOX_SOURCE, CONFIRMATION_SOURCE, D8_RULES, getD8FlowStepStates } from "./d3-d8-defense-visualization-data";

type Props = { isVisible: boolean };
const sources = [CONFIRMATION_SOURCE, COMPOSITE_SANDBOX_SOURCE];
type D8BranchStateId = "allowed" | "denied" | "timeout" | "non-interactive";

export function D8ConfirmationGatePanel({ isVisible }: Props) {
  const [selectedRuleId, setSelectedRuleId] = useState(D8_RULES[0]!.id);
  const [fileName, setFileName] = useState(CONFIRMATION_SOURCE.fileName);
  const rule = D8_RULES.find((item) => item.id === selectedRuleId) ?? D8_RULES[0]!;

  useEffect(() => {
    if (isVisible) {
      setSelectedRuleId(D8_RULES[0]!.id);
      setFileName(CONFIRMATION_SOURCE.fileName);
    }
  }, [isVisible]);

  const selectRule = (nextRule: (typeof D8_RULES)[number]) => {
    setSelectedRuleId(nextRule.id);
    setFileName(nextRule.sourceFile);
  };
  const chooseBranch = (visualStateId: D8BranchStateId) => {
    const nextRule = D8_RULES.find((item) => item.visualStateId === visualStateId);
    if (nextRule) selectRule(nextRule);
  };
  const flowStepStates = getD8FlowStepStates(rule.visualStateId);
  const stateSteps = ["工具已调用", "确认请求已发起", rule.title, "确认已决定", rule.terminal];

  return (
    <D3D8DetailShell
      className="d8-confirmation-panel"
      visual={
        <div className="d8-confirmation-visual" aria-label="确认门控完整状态机">
          <div className="d8-state-machine">
            {stateSteps.map((step, index) => (
              <div
                key={`${step}-${index}`}
                className={`d8-state-step${flowStepStates[index] === "current" ? " is-current" : flowStepStates[index] === "complete" ? " is-complete" : flowStepStates[index] === "blocked" ? " is-blocked" : ""}`}
              >
                <span>{index + 1}</span>
                <strong>{step.split("_").map((part) => <span key={part}>{part}</span>)}</strong>
                {index < stateSteps.length - 1 ? <i aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
          <div className="d8-branch-grid">
            <button type="button" className={rule.visualStateId === "allowed" ? "is-active is-allowed" : "is-allowed"} onClick={() => chooseBranch("allowed")} aria-label="用户允许邮件发送">
              <UserCheck size={18} aria-hidden="true" /><span>用户允许</span><small>进入执行</small>
            </button>
            <button type="button" className={rule.visualStateId === "denied" ? "is-active is-denied" : "is-denied"} onClick={() => chooseBranch("denied")} aria-label="用户拒绝邮件发送">
              <Ban size={18} aria-hidden="true" /><span>用户拒绝</span><small>取消执行</small>
            </button>
            <button type="button" className={rule.visualStateId === "timeout" ? "is-active is-fallback" : "is-fallback"} onClick={() => chooseBranch("timeout")} aria-label="确认等待超时">
              <Clock3 size={18} aria-hidden="true" /><span>等待超时</span><small>按拒绝处理</small>
            </button>
            <button type="button" className={rule.visualStateId === "non-interactive" ? "is-active is-fallback" : "is-fallback"} onClick={() => chooseBranch("non-interactive")} aria-label="非交互模式拒绝">
              <LockKeyhole size={18} aria-hidden="true" /><span>非交互模式</span><small>立即拒绝</small>
            </button>
          </div>
          <div className={`d8-terminal is-${rule.decision}`}>
            {rule.decision === "allowed" ? <Play size={17} aria-hidden="true" /> : <Ban size={17} aria-hidden="true" />}
            <strong>{rule.terminal}</strong>
            <code>{rule.visualStateId === "sandbox-execute" ? "email.send" : rule.decision}</code>
          </div>
        </div>
      }
      sources={sources}
      activeFileName={fileName}
      onFileChange={setFileName}
      fileSelectorPosition="right"
      activeLine={rule.sourceLine}
      rules={D8_RULES}
      selectedRuleId={selectedRuleId}
      onRuleSelect={selectRule}
    />
  );
}
