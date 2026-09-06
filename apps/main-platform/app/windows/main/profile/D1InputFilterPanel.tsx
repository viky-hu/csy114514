"use client";

import { useCallback, useEffect, useState } from "react";
import {
  D1_FILTER_INPUT_META,
  D1_FILTER_OUTPUT_META,
  D1_SANITIZED_CONTENT,
  D1_STAGES,
  D1_UNTRUSTED_CONTENT,
} from "./d1-input-filter-visualization-data";
import { D1FilterTransferArrow } from "./D1FilterTransferArrow";
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
          <D1FilterTransferArrow isVisible={isVisible} />
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
