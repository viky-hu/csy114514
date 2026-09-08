"use client";

import type { CSSProperties } from "react";
import type { DefenseRuleView } from "./d3-d8-defense-visualization-data";

type DefenseExplanationListProps<T extends DefenseRuleView> = {
  rules: readonly T[];
  activeId: string;
  onSelect: (rule: T) => void;
  ariaLabel: string;
};

export function DefenseExplanationList<T extends DefenseRuleView>({
  rules,
  activeId,
  onSelect,
  ariaLabel,
}: DefenseExplanationListProps<T>) {
  return (
    <section className="d1-sanitization-microscope defense-rule-list" aria-label={ariaLabel}>
      <ol
        className="d1-rule-list"
        style={{ "--defense-rule-count": rules.length } as CSSProperties}
      >
        {rules.map((rule) => (
          <li key={rule.id} className={rule.id === activeId ? "is-active" : ""}>
            <button
              type="button"
              className="d1-rule-entry"
              onClick={() => onSelect(rule)}
              aria-pressed={rule.id === activeId}
              aria-label={`${rule.label}：${rule.detail}`}
            >
              <span className="d1-rule-index">{rule.id}</span>
              <span className="d1-rule-copy defense-rule-copy">
                <span className="d1-rule-label">{rule.label}</span>
                <small>{rule.detail}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
