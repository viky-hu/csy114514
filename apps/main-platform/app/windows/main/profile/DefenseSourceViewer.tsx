"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePythonSourceHighlighting } from "./usePythonSourceHighlighting";
import type { SourceSnapshot } from "./d3-d8-defense-visualization-data";

type DefenseSourceViewerProps = {
  sources: readonly SourceSnapshot[];
  activeLine: number;
  activeFileName?: string;
  onFileChange?: (fileName: string) => void;
  fileSelectorPosition?: "left" | "right";
  ariaLabel: string;
};

export function DefenseSourceViewer({
  sources,
  activeLine,
  activeFileName,
  onFileChange,
  fileSelectorPosition = "left",
  ariaLabel,
}: DefenseSourceViewerProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const activeSource = useMemo(
    () => sources.find((source) => source.fileName === activeFileName) ?? sources[0]!,
    [activeFileName, sources],
  );
  const sourceLines = activeSource.source.split(/\r?\n/);
  const highlightedLines = usePythonSourceHighlighting(activeSource.source);
  const fileTabs = sources.length > 1 ? (
    <div className="defense-source-tabs" role="tablist" aria-label="源码文件">
      {sources.map((source) => (
        <button
          key={source.fileName}
          type="button"
          role="tab"
          aria-selected={source.fileName === activeSource.fileName}
          className={source.fileName === activeSource.fileName ? "is-active" : ""}
          onClick={() => onFileChange?.(source.fileName)}
        >
          {source.fileName}
        </button>
      ))}
    </div>
  ) : null;

  useEffect(() => {
    codeRef.current
      ?.querySelector<HTMLElement>(`[data-source-line="${activeLine}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSource.fileName, activeLine]);

  return (
    <section className="d1-source-viewer defense-source-viewer" aria-label={ariaLabel}>
      <header className={`d1-source-viewer-header${fileSelectorPosition === "right" ? " is-file-selector-right" : ""}`}>
        {fileSelectorPosition === "right" ? <span className="d1-source-viewer-stage">源码快照</span> : fileTabs ?? <span>{activeSource.fileName}</span>}
        {fileSelectorPosition === "right" ? fileTabs : <span className="d1-source-viewer-stage">源码快照</span>}
      </header>
      <pre ref={codeRef} className="d1-source-code">
        <code>
          {sourceLines.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <span
                key={`${activeSource.fileName}-${lineNumber}`}
                data-source-line={lineNumber}
                className={lineNumber === activeLine ? "is-active" : ""}
              >
                <span className="d1-source-line-number">{lineNumber}</span>
                <span dangerouslySetInnerHTML={{ __html: highlightedLines?.[index] ?? (line || " ") }} />
              </span>
            );
          })}
        </code>
      </pre>
    </section>
  );
}
