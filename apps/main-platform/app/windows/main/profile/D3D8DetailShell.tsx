"use client";

import type { ReactNode } from "react";
import { DefenseExplanationList } from "./DefenseExplanationList";
import { DefenseSourceViewer } from "./DefenseSourceViewer";
import type { DefenseRuleView, SourceSnapshot } from "./d3-d8-defense-visualization-data";

type D3D8DetailShellProps<T extends DefenseRuleView> = {
  className: string;
  visual: ReactNode;
  sources: readonly SourceSnapshot[];
  activeFileName?: string;
  activeLine: number;
  onFileChange?: (fileName: string) => void;
  fileSelectorPosition?: "left" | "right";
  rules: readonly T[];
  selectedRuleId: string;
  onRuleSelect: (rule: T) => void;
};

export function D3D8DetailShell<T extends DefenseRuleView>({
  className,
  visual,
  sources,
  activeFileName,
  activeLine,
  onFileChange,
  fileSelectorPosition,
  rules,
  selectedRuleId,
  onRuleSelect,
}: D3D8DetailShellProps<T>) {
  return (
    <div className={`defense-detail-panel d3-d8-detail-panel ${className}`}>
      <section className="d3-d8-detail-visual">{visual}</section>
      <div className="defense-detail-lower d3-d8-detail-lower">
        <DefenseSourceViewer
          sources={sources}
          activeFileName={activeFileName}
          activeLine={activeLine}
          onFileChange={onFileChange}
          fileSelectorPosition={fileSelectorPosition}
          ariaLabel="后端实现源码快照"
        />
        <DefenseExplanationList
          rules={rules}
          activeId={selectedRuleId}
          onSelect={onRuleSelect}
          ariaLabel="后端实现规则"
        />
      </div>
    </div>
  );
}
