"use client";

import type { PointerEvent } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import type { TopologyRiskRailModel, TopologyRiskRailSegment } from "./topology-risk-rail";

type TopologyRiskRailProps = {
  model: TopologyRiskRailModel;
  onNavigate: (key: "anatomy" | "run") => void;
  onSegmentHover: (segment: TopologyRiskRailSegment | null) => void;
};

export function TopologyRiskRail({ model, onNavigate, onSegmentHover }: TopologyRiskRailProps) {
  const handleHover = (segment: TopologyRiskRailSegment | null) => {
    onSegmentHover(segment);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    handleHover(null);
  };

  return (
    <div className="topology-risk-rail" aria-label={`${model.riskPatternId} 风险解释轨道`} onPointerLeave={handlePointerLeave}>
      <div className="topology-risk-rail-segments">
        {model.segments.map((segment) => (
          <button
            key={segment.id}
            className={`topology-risk-rail-segment is-${segment.tone}`}
            data-rail-segment={segment.id}
            onFocus={() => handleHover(segment)}
            onMouseEnter={() => handleHover(segment)}
            onBlur={() => handleHover(null)}
            type="button"
          >
            <span className="topology-risk-rail-label">{segment.label}</span>
            <strong>{segment.value}</strong>
          </button>
        ))}
      </div>
      <div className="topology-risk-rail-actions">
        <button className="overview-icon-command is-secondary" onClick={() => onNavigate("run")} type="button">
          <Activity size={15} aria-hidden="true" />
          <span>{model.primaryAction}</span>
        </button>
        <button className="overview-icon-command" onClick={() => onNavigate("anatomy")} type="button">
          <ArrowUpRight size={15} aria-hidden="true" />
          <span>{model.secondaryAction}</span>
        </button>
      </div>
    </div>
  );
}
