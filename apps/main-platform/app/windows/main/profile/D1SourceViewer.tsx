"use client";

import { useEffect, useMemo, useRef } from "react";
import { D1_STAGES, INPUT_FILTER_SOURCE } from "./d1-input-filter-visualization-data";
import { usePythonSourceHighlighting } from "./usePythonSourceHighlighting";

type D1SourceViewerProps = {
  activeStage: number;
};

export function D1SourceViewer({ activeStage }: D1SourceViewerProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const lines = INPUT_FILTER_SOURCE.split(/\r?\n/);
  const activeLine = D1_STAGES[activeStage]?.sourceLine ?? 1;
  const source = useMemo(() => INPUT_FILTER_SOURCE, []);
  const highlightedLines = usePythonSourceHighlighting(source);

  useEffect(() => {
    const node = codeRef.current?.querySelector<HTMLElement>(
      `[data-source-line="${activeLine}"]`,
    );
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine]);

  return (
    <section className="d1-source-viewer" aria-label="input_filter.py 源码">
      <header className="d1-source-viewer-header">
        <span>input_filter.py</span>
        <span className="d1-source-viewer-stage">源码快照</span>
      </header>
      <pre ref={codeRef} className="d1-source-code">
        <code>
        {lines.map((sourceLine, index) => {
          const lineNumber = index + 1;
          return (
            <span
              key={lineNumber}
              data-source-line={lineNumber}
              className={lineNumber === activeLine ? "is-active" : ""}
            >
              <span className="d1-source-line-number">{lineNumber}</span>
              <span
                dangerouslySetInnerHTML={{
                  __html: highlightedLines?.[index] ?? (sourceLine || " "),
                }}
              />
            </span>
          );
        })}
        </code>
      </pre>
    </section>
  );
}
