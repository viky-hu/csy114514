"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import type { LucideIcon } from "lucide-react";
import { Bot, DatabaseZap, Globe2, MailCheck } from "lucide-react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import type { OverviewAttackChainNode } from "./overview-data";
import {
  buildOrthogonalRouteSegments,
  createClockwiseRoundedRectPath,
  findHoverStepIndex,
  hoverBands,
  R4_GRAPH_VIEWBOX,
  R4_LAYER_BAND_HEIGHT,
  R4_LAYER_BANDS,
  R4_STEP_LAYOUTS,
  type R4StepLayout,
} from "./overview-r4-layout";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type OverviewR4GraphProps = {
  nodes: OverviewAttackChainNode[];
};

type DrawSVGTweenVars = gsap.TweenVars & {
  drawSVG?: number | string;
};

type NodeStyleVars = CSSProperties &
  Record<"--node-height" | "--node-left" | "--node-top" | "--node-width", string>;

type HotZoneStyleVars = CSSProperties &
  Record<"--hot-left" | "--hot-width", string>;

const NODE_ICONS: Record<R4StepLayout["icon"], LucideIcon> = {
  agent: Bot,
  email: MailCheck,
  memory: DatabaseZap,
  web: Globe2,
};

const NODE_TYPE_LABELS: Record<string, string> = {
  AGENT: "智能体",
  DATA: "数据",
  MEMORY: "记忆",
  SOURCE: "来源",
  TOOL: "工具",
};

const SECURITY_LABELS: Record<string, string> = {
  DANGEROUS: "危险动作",
  PERSISTENT: "持久化",
  SENSITIVE: "敏感",
  TRUSTED: "可信",
  UNTRUSTED: "不可信",
};

function formatNodeType(nodeType: string) {
  return NODE_TYPE_LABELS[nodeType] ?? nodeType;
}

function formatSecurityLabels(labels: string[]) {
  return labels.length > 0
    ? labels.map((label) => SECURITY_LABELS[label] ?? label).join(" / ")
    : "无";
}

function getNodeOverlayStyle(layout: R4StepLayout): NodeStyleVars {
  return {
    "--node-height": `${(layout.height / R4_GRAPH_VIEWBOX.height) * 100}%`,
    "--node-left": `${
      ((layout.x - layout.width / 2) / R4_GRAPH_VIEWBOX.width) * 100
    }%`,
    "--node-top": `${
      ((layout.y - layout.height / 2) / R4_GRAPH_VIEWBOX.height) * 100
    }%`,
    "--node-width": `${(layout.width / R4_GRAPH_VIEWBOX.width) * 100}%`,
  };
}

function getHotZoneStyle(
  band: (typeof hoverBands)[number],
): HotZoneStyleVars {
  return {
    "--hot-left": `${(band.xStart / R4_GRAPH_VIEWBOX.width) * 100}%`,
    "--hot-width": `${
      ((band.xEnd - band.xStart) / R4_GRAPH_VIEWBOX.width) * 100
    }%`,
  };
}

function isReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OverviewR4Graph({ nodes }: OverviewR4GraphProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<number | null>(null);
  const animatedStepRef = useRef<number | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const routeSegments = useMemo(() => buildOrthogonalRouteSegments(), []);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const matchMedia = gsap.matchMedia();

      matchMedia.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);
          const layerBands = gsap.utils.toArray<SVGRectElement>(
            ".overview-r4-layer-band",
            root,
          );
          const separators = gsap.utils.toArray<SVGPathElement>(
            ".overview-r4-layer-separator",
            root,
          );
          const routePaths = gsap.utils.toArray<SVGPathElement>(
            ".overview-r4-route-segment",
            root,
          );
          const nodeGroups = gsap.utils.toArray<SVGGElement>(
            ".overview-r4-node",
            root,
          );
          const hoverOutlines = gsap.utils.toArray<SVGPathElement>(
            ".overview-r4-hover-outline",
            root,
          );
          const hotZones = gsap.utils.toArray<HTMLElement>(
            ".overview-r4-hot-zone",
            root,
          );

          gsap.set(hotZones, { autoAlpha: 0, scaleX: 0.92 });
          gsap.set(hoverOutlines, { drawSVG: "0% 0%" } as DrawSVGTweenVars);

          if (reduceMotion) {
            gsap.set([...layerBands, ...nodeGroups], {
              autoAlpha: 1,
              scale: 1,
              y: 0,
            });
            gsap.set([...separators, ...routePaths], {
              drawSVG: "0% 100%",
            } as DrawSVGTweenVars);

            return;
          }

          gsap.set(layerBands, { autoAlpha: 0 });
          gsap.set([...separators, ...routePaths], {
            drawSVG: "0% 0%",
          } as DrawSVGTweenVars);
          gsap.set(nodeGroups, {
            autoAlpha: 0,
            scale: 0.97,
            transformOrigin: "center center",
            y: 8,
          });

          const timeline = gsap.timeline({
            defaults: { ease: LINE_DRAW_EASE },
          });

          timeline
            .to(layerBands, {
              autoAlpha: 1,
              duration: 0.44,
              stagger: 0.07,
            })
            .to(
              separators,
              {
                drawSVG: "0% 100%",
                duration: 0.5,
                stagger: 0.06,
              } as DrawSVGTweenVars,
              "<0.1",
            )
            .to(
              routePaths,
              {
                drawSVG: "0% 100%",
                duration: 0.62,
                stagger: 0.16,
              } as DrawSVGTweenVars,
              "<0.12",
            )
            .to(
              nodeGroups,
              {
                autoAlpha: 1,
                duration: 0.42,
                scale: 1,
                stagger: 0.07,
                y: 0,
              },
              "<0.18",
            );

          return () => {
            timeline.kill();
          };
        },
      );

      return () => {
        matchMedia.revert();
      };
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      const root = rootRef.current;
      const previousStep = animatedStepRef.current;

      if (!root || previousStep === activeStep) {
        return;
      }

      const reduceMotion = isReducedMotion();
      const hotZones = gsap.utils.toArray<HTMLElement>(
        ".overview-r4-hot-zone",
        root,
      );
      const nodeGroups = gsap.utils.toArray<SVGGElement>(
        ".overview-r4-node",
        root,
      );
      const hoverOutlines = gsap.utils.toArray<SVGPathElement>(
        ".overview-r4-hover-outline",
        root,
      );

      animatedStepRef.current = activeStep;

      if (previousStep !== null) {
        gsap.to(hotZones[previousStep], {
          autoAlpha: 0,
          duration: reduceMotion ? 0 : 0.2,
          ease: "power2.out",
          overwrite: "auto",
          scaleX: 0.92,
        });
        gsap.to(nodeGroups[previousStep], {
          duration: reduceMotion ? 0 : 0.24,
          ease: "power2.out",
          overwrite: "auto",
          scale: 1,
          y: 0,
        });
        gsap.set(hoverOutlines[previousStep], {
          drawSVG: "0% 0%",
        } as DrawSVGTweenVars);
      }

      if (activeStep !== null) {
        gsap.to(hotZones[activeStep], {
          autoAlpha: 1,
          duration: reduceMotion ? 0 : 0.24,
          ease: "power2.out",
          overwrite: "auto",
          scaleX: 1,
        });
        gsap.to(nodeGroups[activeStep], {
          duration: reduceMotion ? 0 : 0.26,
          ease: "power2.out",
          overwrite: "auto",
          scale: 1.035,
          y: -5,
        });

        if (reduceMotion) {
          gsap.set(hoverOutlines[activeStep], {
            drawSVG: "0% 100%",
          } as DrawSVGTweenVars);
        } else {
          gsap.fromTo(
            hoverOutlines[activeStep],
            { drawSVG: "0% 0%" } as DrawSVGTweenVars,
            {
              drawSVG: "0% 100%",
              duration: 0.52,
              ease: "power2.inOut",
              overwrite: "auto",
            } as DrawSVGTweenVars,
          );
        }
      }
    },
    { dependencies: [activeStep], revertOnUpdate: false, scope: rootRef },
  );

  const activateStep = useCallback((nextStep: number | null) => {
    if (activeStepRef.current === nextStep) {
      return;
    }

    activeStepRef.current = nextStep;
    setActiveStep(nextStep);
  }, []);

  const setActiveStepFromClientX = useCallback(
    (clientX: number) => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const bounds = root.getBoundingClientRect();
      const viewBoxX =
        ((clientX - bounds.left) / bounds.width) * R4_GRAPH_VIEWBOX.width;

      activateStep(findHoverStepIndex(viewBoxX));
    },
    [activateStep],
  );

  return (
    <div
      ref={rootRef}
      className="overview-map-frame overview-r4-graph"
      onPointerEnter={(event) => setActiveStepFromClientX(event.clientX)}
      onPointerLeave={() => activateStep(null)}
      onPointerMove={(event) => setActiveStepFromClientX(event.clientX)}
    >
      <div className="overview-r4-hot-zone-layer" aria-hidden="true">
        {hoverBands.map((band) => (
          <div
            key={band.id}
            className={`overview-r4-hot-zone${
              activeStep === band.stepIndex ? " is-active" : ""
            }`}
            data-step-index={band.stepIndex}
            style={getHotZoneStyle(band)}
          />
        ))}
      </div>

      <svg
        className="overview-chain-svg overview-r4-svg"
        viewBox="0 0 880 340"
        role="img"
        aria-label="R4 风险路径从不可信网页进入 Agent，写入持久记忆，再唤起 Agent 并触发邮件发送"
      >
        <defs>
          <linearGradient id="overview-r4-route-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3152f4" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#3152f4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f04438" stopOpacity="0.9" />
          </linearGradient>
          <marker
            id="overview-r4-arrow"
            markerHeight="8"
            markerWidth="9"
            orient="auto"
            refX="7.6"
            refY="4"
            viewBox="0 0 9 8"
          >
            <path d="M0 1 L7.5 4 L0 7" fill="none" stroke="#3152f4" strokeWidth="1.6" />
          </marker>
          <filter
            id="overview-r4-outline-glow"
            x="-25%"
            y="-40%"
            width="150%"
            height="180%"
          >
            <feDropShadow
              dx="0"
              dy="0"
              floodColor="#ffffff"
              floodOpacity="0.72"
              stdDeviation="3.2"
            />
          </filter>
        </defs>

        <rect className="overview-r4-boundary" x="32" y="26" width="816" height="288" />

        {R4_LAYER_BANDS.map((band) => (
          <g key={band.id} className={`overview-r4-layer is-${band.id}`}>
            <rect
              className={`overview-r4-layer-band is-${band.id}`}
              x="42"
              y={band.y}
              width="796"
              height={R4_LAYER_BAND_HEIGHT}
              rx="8"
            />
            <text className="overview-r4-layer-label" x="58" y={band.y + 26}>
              {band.layerLabel}
            </text>
            <text className="overview-r4-layer-title" x="58" y={band.y + 49}>
              {band.title}
            </text>
            <text className="overview-r4-layer-subtitle" x="58" y={band.y + 68}>
              {band.subtitle}
            </text>
          </g>
        ))}

        <path className="overview-r4-layer-separator" d="M48 123 H832" fill="none" />
        <path className="overview-r4-layer-separator" d="M48 217 H832" fill="none" />

        <g className="overview-r4-routes" aria-hidden="true">
          {routeSegments.map((route) => (
            <path
              key={route.id}
              className={`overview-r4-route-segment is-${route.id}`}
              d={route.d}
              fill="none"
              markerEnd="url(#overview-r4-arrow)"
              stroke="url(#overview-r4-route-stroke)"
            />
          ))}
        </g>

        <g className="overview-r4-nodes">
          {nodes.map((node, index) => {
            const layout =
              R4_STEP_LAYOUTS[index] ?? R4_STEP_LAYOUTS[R4_STEP_LAYOUTS.length - 1];
            const Icon = NODE_ICONS[layout.icon];
            const rectPath = createClockwiseRoundedRectPath(layout);
            const iconX = layout.x - 12;
            const iconY = layout.y - 25;

            return (
              <g
                key={`${node.id}-${layout.id}`}
                className={`overview-r4-node overview-chain-node is-${node.role}${
                  activeStep === index ? " is-active" : ""
                }`}
                data-step-index={index}
              >
                <title>{node.description}</title>
                <path className="overview-r4-node-surface" d={rectPath} />
                <path
                  className="overview-r4-hover-outline"
                  d={rectPath}
                  filter="url(#overview-r4-outline-glow)"
                />
                <Icon
                  aria-hidden="true"
                  className="overview-r4-node-icon"
                  height={24}
                  width={24}
                  x={iconX}
                  y={iconY}
                  strokeWidth={1.65}
                />
                <text
                  className="overview-r4-node-label"
                  x={layout.x}
                  y={layout.y + 8}
                  textAnchor="middle"
                >
                  {node.displayLabel}
                </text>
                <text
                  className="overview-r4-node-caption"
                  x={layout.x}
                  y={layout.y + 28}
                  textAnchor="middle"
                >
                  {layout.caption}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="overview-node-popover-layer" aria-hidden="false">
        {nodes.map((node, index) => {
          const layout =
            R4_STEP_LAYOUTS[index] ?? R4_STEP_LAYOUTS[R4_STEP_LAYOUTS.length - 1];
          const detailId = `overview-node-detail-${layout.id}`;

          return (
            <div
              key={`${node.id}-${layout.id}-detail`}
              aria-describedby={detailId}
              aria-label={`${node.displayLabel} 详情`}
              className={`overview-node-hitbox is-${node.role} is-${layout.id}`}
              onBlur={() => activateStep(null)}
              onFocus={() => activateStep(index)}
              role="group"
              style={getNodeOverlayStyle(layout)}
              tabIndex={0}
            >
              <div id={detailId} className="overview-node-popover" role="tooltip">
                <strong>{node.displayLabel}</strong>
                <span>
                  {node.layerLabel} / {layout.caption}
                </span>
                <p>{node.description}</p>
                <dl>
                  <div>
                    <dt>类型</dt>
                    <dd>{formatNodeType(node.nodeType)}</dd>
                  </div>
                  <div>
                    <dt>标签</dt>
                    <dd>{formatSecurityLabels(node.securityLabels)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
