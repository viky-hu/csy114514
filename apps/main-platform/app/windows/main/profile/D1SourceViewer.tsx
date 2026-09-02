"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createHighlighterCore, createJavaScriptRegexEngine } from "shiki";
import python from "shiki/langs/python.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { D1_STAGES, INPUT_FILTER_SOURCE } from "./d1-input-filter-visualization-data";

type D1SourceViewerProps = {
  activeStage: number;
};

export function D1SourceViewer({ activeStage }: D1SourceViewerProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const lines = INPUT_FILTER_SOURCE.split(/\r?\n/);
  const activeLine = D1_STAGES[activeStage]?.sourceLine ?? 1;
  const [highlightedLines, setHighlightedLines] = useState<string[] | null>(null);
  const source = useMemo(() => INPUT_FILTER_SOURCE, []);

  useEffect(() => {
    let cancelled = false;
    const loadHighlighting = async () => {
      const highlighter = await createHighlighterCore({
        langs: [python],
        themes: [githubLight],
        engine: createJavaScriptRegexEngine(),
      });
      const tokenLines = highlighter.codeToTokens(source, {
        lang: "python",
        theme: "github-light",
      }).tokens;
      if (!cancelled) {
        setHighlightedLines(
          tokenLines.map((tokens) =>
            tokens
              .map((token) => {
                const escaped = token.content
                  .replaceAll("&", "&amp;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;")
                  .replaceAll('"', "&quot;")
                  .replaceAll("'", "&#39;");
                const color = token.color ?? "#30405c";
                return `<span style="color:${color}">${escaped}</span>`;
              })
              .join(""),
          ),
        );
      }
      highlighter.dispose();
    };
    void loadHighlighting();
    return () => {
      cancelled = true;
    };
  }, [source]);

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
