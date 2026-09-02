"use client";

import { D1_RULES } from "./d1-input-filter-visualization-data";

type D1SanitizationMicroscopeProps = {
  activeStage: number;
  onStageChange: (index: number) => void;
};

export function D1SanitizationMicroscope({
  activeStage,
  onStageChange,
}: D1SanitizationMicroscopeProps) {
  return (
    <section className="d1-sanitization-microscope" aria-label="输入过滤规则">
      <ol className="d1-rule-list" aria-label="五个净化步骤">
        {D1_RULES.map((rule, index) => (
          <li key={rule.type} className={index === activeStage ? "is-active" : ""}>
            <button
              type="button"
              className="d1-rule-entry"
              onClick={() => onStageChange(index)}
              aria-pressed={index === activeStage}
              aria-label={`${rule.id} ${rule.label}`}
            >
              <span className="d1-rule-index">{rule.id}</span>
              <span className="d1-rule-copy">
                <span className="d1-rule-label">{rule.label}</span>
                <small>{rule.detail}</small>
                <code>{rule.token}</code>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
