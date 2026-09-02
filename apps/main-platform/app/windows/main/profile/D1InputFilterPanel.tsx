"use client";

import { useCallback, useEffect, useState } from "react";
import {
  D1_FILTER_INPUT_META,
  D1_FILTER_OUTPUT_META,
  D1_SANITIZED_CONTENT,
  D1_STAGES,
  D1_UNTRUSTED_CONTENT,
} from "./d1-input-filter-visualization-data";
import { D1SanitizationMicroscope } from "./D1SanitizationMicroscope";
import { D1SourceViewer } from "./D1SourceViewer";

type D1InputFilterPanelProps = {
  isVisible: boolean;
};

export function D1InputFilterPanel({
  isVisible,
}: D1InputFilterPanelProps) {
  const [activeStage, setActiveStage] = useState(0);
  const onStageChange = useCallback((index: number) => {
    setActiveStage(Math.max(0, Math.min(index, D1_STAGES.length - 1)));
  }, []);

  useEffect(() => {
    if (isVisible) setActiveStage(0);
  }, [isVisible]);

  return (
    <div className="d1-input-filter-panel">
      <section className="d1-input-filter-comparison" aria-label="输入输出对比">
        <div className="d1-comparison-grid">
          <article className="d1-comparison-pane is-untrusted">
            <header>
              <div className="d1-comparison-copy">
                <span>{D1_FILTER_INPUT_META.label}</span>
                <small>{D1_FILTER_INPUT_META.description}</small>
              </div>
              <span className="d1-comparison-marker">
                {D1_FILTER_INPUT_META.marker}
              </span>
            </header>
            <code className="d1-comparison-code">{D1_UNTRUSTED_CONTENT}</code>
          </article>
          <D1FilterTransferArrow />
          <article className="d1-comparison-pane is-sanitized">
            <header>
              <div className="d1-comparison-copy">
                <span>{D1_FILTER_OUTPUT_META.label}</span>
                <small>{D1_FILTER_OUTPUT_META.description}</small>
              </div>
              <span className="d1-comparison-marker">
                {D1_FILTER_OUTPUT_META.marker}
              </span>
            </header>
            <code className="d1-comparison-code">{D1_SANITIZED_CONTENT}</code>
          </article>
        </div>
      </section>
      <div className="d1-input-filter-lower">
        <D1SourceViewer activeStage={activeStage} />
        <D1SanitizationMicroscope
          activeStage={activeStage}
          onStageChange={onStageChange}
        />
      </div>
    </div>
  );
}

function D1FilterTransferArrow() {
  return (
    <svg
      className="d1-filter-arrow"
      viewBox="0 0 96 72"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="d1-filter-arrow-flow" x1="10" y1="0" x2="86" y2="0">
          <stop offset="0" stopColor="#b42318" stopOpacity="0.48" />
          <stop offset="0.5" stopColor="#3152f4" stopOpacity="0.78" />
          <stop offset="1" stopColor="#218c63" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <path className="d1-filter-arrow-shadow" d="M14 36h26" />
      <path className="d1-filter-arrow-shadow" d="M56 36h24" />
      <circle className="d1-filter-arrow-input" cx="15" cy="36" r="4.5" />
      <path className="d1-filter-arrow-line" d="M18 36h22" />
      <path className="d1-filter-arrow-gate" d="M42 22h14l8 14-8 14H42l-8-14z" />
      <path className="d1-filter-arrow-line" d="M56 36h22" />
      <path className="d1-filter-arrow-head" d="M76 27l12 9-12 9" />
      <circle className="d1-filter-arrow-output" cx="84" cy="36" r="3.5" />
    </svg>
  );
}
