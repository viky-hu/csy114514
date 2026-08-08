"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  R4_ATTACK_CHAIN_START_X,
  R4_GRAPH_BOUNDARY,
  R4_GRAPH_VIEWBOX,
  R4_LAYER_BAND_HEIGHT,
  R4_LAYER_BAND_WIDTH,
  R4_LAYER_BAND_X,
  R4_LAYER_BANDS,
  R4_LAYER_INFO_BOUNDARY_X,
  R4_LAYER_INFO_TEXT_MAX_WIDTH,
  R4_LAYER_INFO_TEXT_X,
  R4_STEP_LAYOUTS,
  type R4StepLayout,
} from "./overview-r4-layout";
import {
  calculateMeetViewport,
  clientPointToSvgUserPoint,
  measureSvgViewportMetrics,
  svgUserRectToFrameStyle,
  type SvgViewportMetrics,
} from "./overview-r4-svg-viewport";

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
  Record<"--hot-height" | "--hot-left" | "--hot-top" | "--hot-width", string>;

const INITIAL_SVG_VIEWPORT = calculateMeetViewport({
  frameHeight: 0,
  frameWidth: 0,
  viewBox: R4_GRAPH_VIEWBOX,
});

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

function getNodeOverlayStyle(
  layout: R4StepLayout,
  metrics: SvgViewportMetrics,
): NodeStyleVars {
  const rect = svgUserRectToFrameStyle(
    {
      bottom: layout.y + layout.height / 2,
      left: layout.x - layout.width / 2,
      right: layout.x + layout.width / 2,
      top: layout.y - layout.height / 2,
    },
    metrics,
  );

  return {
    "--node-height": `${rect.height}px`,
    "--node-left": `${rect.left}px`,
    "--node-top": `${rect.top}px`,
    "--node-width": `${rect.width}px`,
  };
}

function getHotZoneStyle(
  band: (typeof hoverBands)[number],
  metrics: SvgViewportMetrics,
): HotZoneStyleVars {
  const rect = svgUserRectToFrameStyle(
    {
      bottom: R4_GRAPH_VIEWBOX.height,
      left: band.xStart,
      right: band.xEnd,
      top: 0,
    },
    metrics,
  );

  return {
    "--hot-height": `${rect.height}px`,
    "--hot-left": `${rect.left}px`,
    "--hot-top": `${rect.top}px`,
    "--hot-width": `${rect.width}px`,
  };
}

function isReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OverviewR4Graph({ nodes }: OverviewR4GraphProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const activeStepRef = useRef<number | null>(null);
  const animatedStepRef = useRef<number | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [svgViewport, setSvgViewport] =
    useState<SvgViewportMetrics>(INITIAL_SVG_VIEWPORT);
  const routeSegments = useMemo(() => buildOrthogonalRouteSegments(), []);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;

    if (!root || !svg) {
      return;
    }

    let animationFrame: number | null = null;

    const refreshSvgViewport = () => {
      const nextViewport = measureSvgViewportMetrics(svg, root, R4_GRAPH_VIEWBOX);

      setSvgViewport((previousViewport) => {
        if (
          Math.abs(previousViewport.height - nextViewport.height) < 0.01 &&
          Math.abs(previousViewport.offsetLeft - nextViewport.offsetLeft) < 0.01 &&
          Math.abs(previousViewport.offsetTop - nextViewport.offsetTop) < 0.01 &&
          Math.abs(previousViewport.scale - nextViewport.scale) < 0.0001 &&
          Math.abs(previousViewport.width - nextViewport.width) < 0.01
        ) {
          return previousViewport;
        }

        return nextViewport;
      });
    };

    const scheduleRefresh = () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        refreshSvgViewport();
      });
    };

    refreshSvgViewport();

    const resizeObserver = new ResizeObserver(scheduleRefresh);
    resizeObserver.observe(root);
    resizeObserver.observe(svg);
    window.addEventListener("resize", scheduleRefresh);

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
    };
  }, []);

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
          const layerInfoGroups = gsap.utils.toArray<SVGGElement>(
            ".overview-r4-layer-info",
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

          gsap.set(hotZones, {
            "--hot-rail-alpha": 0,
            autoAlpha: 0,
          });
          gsap.set(hoverOutlines, { drawSVG: "0% 0%" } as DrawSVGTweenVars);

          if (reduceMotion) {
            gsap.set([...layerBands, ...layerInfoGroups, ...nodeGroups], {
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
          gsap.set(layerInfoGroups, {
            autoAlpha: 0,
            y: -2,
          });
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
              layerInfoGroups,
              {
                autoAlpha: 1,
                duration: 0.32,
                stagger: 0.07,
                y: 0,
              },
              "<0.08",
            )
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
          "--hot-rail-alpha": 0,
          autoAlpha: 0,
          duration: reduceMotion ? 0 : 0.2,
          ease: "power2.out",
          overwrite: "auto",
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
          "--hot-rail-alpha": 1,
          autoAlpha: 1,
          duration: reduceMotion ? 0 : 0.24,
          ease: "power2.out",
          overwrite: "auto",
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
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;

      if (!svg) {
        return;
      }

      const svgPoint = clientPointToSvgUserPoint(svg, clientX, clientY);

      if (!svgPoint) {
        activateStep(null);
        return;
      }

      activateStep(findHoverStepIndex(svgPoint.x));
    },
    [activateStep],
  );

  return (
    <div
      ref={rootRef}
      className="overview-map-frame overview-r4-graph"
      onPointerEnter={(event) =>
        setActiveStepFromClientX(event.clientX, event.clientY)
      }
      onPointerLeave={() => activateStep(null)}
      onPointerMove={(event) =>
        setActiveStepFromClientX(event.clientX, event.clientY)
      }
    >
      <div className="overview-r4-hot-zone-layer" aria-hidden="true">
        {hoverBands.map((band) => (
          <div
            key={band.id}
            className={`overview-r4-hot-zone${
              activeStep === band.stepIndex ? " is-active" : ""
            }`}
            data-step-index={band.stepIndex}
            style={getHotZoneStyle(band, svgViewport)}
          />
        ))}
      </div>

      <svg
        ref={svgRef}
        className="overview-chain-svg overview-r4-svg"
        viewBox="0 0 1000 440"
        role="img"
        aria-label="R4 风险路径从不可信网页进入 Agent，写入持久记忆，再唤起 Agent 并触发邮件发送"
      >
        <defs>
          <linearGradient id="overview-r4-route-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3152f4" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#3152f4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f04438" stopOpacity="0.9" />
          </linearGradient>
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

        <rect
          className="overview-r4-boundary"
          x={R4_GRAPH_BOUNDARY.x}
          y={R4_GRAPH_BOUNDARY.y}
          width={R4_GRAPH_BOUNDARY.width}
          height={R4_GRAPH_BOUNDARY.height}
        />

        {R4_LAYER_BANDS.map((band) => (
          <g key={band.id} className={`overview-r4-layer is-${band.id}`}>
            <rect
              className={`overview-r4-layer-band is-${band.id}`}
              x={R4_LAYER_BAND_X}
              y={band.y}
              width={R4_LAYER_BAND_WIDTH}
              height={R4_LAYER_BAND_HEIGHT}
              rx="8"
            />
          </g>
        ))}

        <path
          className="overview-r4-layer-info-divider"
          d={`M${R4_LAYER_INFO_BOUNDARY_X} 34 V394`}
          fill="none"
        />
        <path
          className="overview-r4-attack-start-guide"
          d={`M${R4_ATTACK_CHAIN_START_X} 34 V394`}
          fill="none"
        />
        <path className="overview-r4-layer-separator" d="M48 151 H952" fill="none" />
        <path className="overview-r4-layer-separator" d="M48 277 H952" fill="none" />

        <g className="overview-r4-layer-info-layer">
          {R4_LAYER_BANDS.map((band) => (
            <g key={`${band.id}-info`} className="overview-r4-layer-info">
              <text
                className="overview-r4-layer-label"
                x={R4_LAYER_INFO_TEXT_X}
                y={band.y + 26}
              >
                {band.layerLabel}
              </text>
              <text
                className="overview-r4-layer-title"
                x={R4_LAYER_INFO_TEXT_X}
                y={band.y + 49}
              >
                {band.title}
              </text>
              <text
                className="overview-r4-layer-subtitle"
                lengthAdjust="spacingAndGlyphs"
                textLength={
                  band.id === "memory-tool" ? R4_LAYER_INFO_TEXT_MAX_WIDTH : undefined
                }
                x={R4_LAYER_INFO_TEXT_X}
                y={band.y + 68}
              >
                {band.subtitle}
              </text>
            </g>
          ))}
        </g>

        <g className="overview-r4-routes" aria-hidden="true">
          {routeSegments.map((route) => (
            <path
              key={route.id}
              className={`overview-r4-route-segment is-${route.id}`}
              d={route.d}
              fill="none"
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
            const iconY = layout.y - 34;

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
                  y={layout.y + 14}
                  textAnchor="middle"
                >
                  {node.displayLabel}
                </text>
                <text
                  className="overview-r4-node-caption"
                  x={layout.x}
                  y={layout.y + 34}
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
              style={getNodeOverlayStyle(layout, svgViewport)}
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
