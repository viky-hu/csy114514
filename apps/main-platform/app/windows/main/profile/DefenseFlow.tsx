"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DEFENSE_LAYERS } from "./defense-visualization-data";

type DefenseFlowProps = {
  selectedIndex: number;
  isVisible: boolean;
};

export function DefenseFlow({ selectedIndex, isVisible }: DefenseFlowProps) {
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
      const nodes = gsap.utils.toArray<SVGCircleElement>(
        ".security-defense-flow-node",
        svg,
      );
      const segments = gsap.utils.toArray<SVGLineElement>(
        ".security-defense-flow-segment",
        svg,
      );
      const activeNode = nodes[selectedIndex];

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
    { dependencies: [selectedIndex, isVisible], scope: svgRef, revertOnUpdate: false },
  );

  const points = DEFENSE_LAYERS.map((_, index) => 40 + index * 217.15);

  return (
    <svg
      ref={svgRef}
      className="security-defense-flow"
      viewBox="0 0 1600 50"
      role="img"
      aria-label="D1 至 D8 防御层流程"
      preserveAspectRatio="xMidYMid meet"
    >
      {points.slice(0, -1).map((point, index) => (
        <line
          key={`segment-${index}`}
          className={`security-defense-flow-segment${
            selectedIndex === index || selectedIndex === index + 1
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
      {points.map((point, index) => (
        <g key={DEFENSE_LAYERS[index]!.id}>
          <circle
            className={`security-defense-flow-node${
              selectedIndex === index ? " is-active" : ""
            }`}
            cx={point}
            cy="17"
            r="6.2"
            data-defense-flow-node={index}
          />
          <text x={point} y="40" textAnchor="middle">
            {DEFENSE_LAYERS[index]!.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
