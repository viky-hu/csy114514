"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DEFENSE_DISPLAY_ITEMS } from "./defense-visualization-data";

type DefenseFlowProps = {
  selectedDisplayIndex: number;
  isVisible: boolean;
};

export function DefenseFlow({
  selectedDisplayIndex,
  isVisible,
}: DefenseFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const svg = svgRef.current;
      if (!svg) {
        return;
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const nodes = gsap.utils.toArray<SVGElement>(
        ".security-defense-flow-node",
        svg,
      );
      const segments = gsap.utils.toArray<SVGLineElement>(
        ".security-defense-flow-segment",
        svg,
      );
      const activeNode = nodes[selectedDisplayIndex];

      gsap.killTweensOf([...nodes, ...segments]);
      gsap.set(nodes, { transformOrigin: "center center" });

      if (reducedMotion || !isVisible) {
        gsap.set(nodes, { scale: 1 });
        gsap.set(segments, { strokeDashoffset: 0 });
        return;
      }

      if (activeNode) {
        gsap.fromTo(
          activeNode,
          { scale: 0.64 },
          { scale: 1, duration: 0.46, ease: "back.out(1.8)", overwrite: "auto" },
        );
      }
      gsap.fromTo(
        segments,
        { strokeDashoffset: 16 },
        {
          strokeDashoffset: 0,
          duration: 0.48,
          ease: "power2.out",
          stagger: 0.018,
          overwrite: "auto",
        },
      );
    },
    {
      dependencies: [selectedDisplayIndex, isVisible],
      scope: svgRef,
      revertOnUpdate: false,
    },
  );

  const horizontalInset = 92;
  const pointDistance =
    (1600 - horizontalInset * 2) / (DEFENSE_DISPLAY_ITEMS.length - 1);
  const points = DEFENSE_DISPLAY_ITEMS.map(
    (_, index) => horizontalInset + index * pointDistance,
  );

  return (
    <svg
      ref={svgRef}
      className="security-defense-flow"
      viewBox="0 0 1600 82"
      role="img"
      aria-label="D1 至 D8 防御层与 LLM tool calls 桥段流程"
      preserveAspectRatio="xMidYMid meet"
    >
      {points.slice(0, -1).map((point, index) => (
        <line
          key={`segment-${index}`}
          className={`security-defense-flow-segment${
            selectedDisplayIndex === index || selectedDisplayIndex === index + 1
              ? " is-active"
              : ""
          }`}
          x1={point}
          y1="17"
          x2={points[index + 1]}
          y2="17"
          data-defense-flow-segment={index}
        />
      ))}
      {points.map((point, index) => {
        const item = DEFENSE_DISPLAY_ITEMS[index]!;
        const isActive = selectedDisplayIndex === index;
        return (
          <g key={item.kind === "bridge" ? item.id : item.displayId}>
            {item.kind === "bridge" ? (
              <path
                className={`security-defense-flow-node security-defense-flow-bridge-node${
                  isActive ? " is-active" : ""
                }`}
                d={`M ${point} 8 L ${point + 9} 17 L ${point} 26 L ${point - 9} 17 Z`}
                data-defense-flow-node={index}
              />
            ) : (
              <circle
                className={`security-defense-flow-node${
                  isActive ? " is-active" : ""
                }`}
                cx={point}
                cy="17"
                r="6.2"
                data-defense-flow-node={index}
              />
            )}
            {item.kind === "bridge" ? (
              <>
                <text
                  className="security-defense-flow-label"
                  x={point}
                  y="42"
                  textAnchor="middle"
                >
                  <tspan x={point}>LLM 推理</tspan>
                </text>
                <text
                  className="security-defense-flow-id"
                  x={point}
                  y="68"
                  textAnchor="middle"
                >
                  BRIDGE
                </text>
              </>
            ) : (
              <>
                <text
                  className="security-defense-flow-label"
                  x={point}
                  y="42"
                  textAnchor="middle"
                >
                  {item.label}
                </text>
                <text
                  className="security-defense-flow-id"
                  x={point}
                  y="68"
                  textAnchor="middle"
                >
                  {item.displayId}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
