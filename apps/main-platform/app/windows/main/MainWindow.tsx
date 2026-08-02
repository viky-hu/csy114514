"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { LINE_DRAW_EASE } from "../shared/animation";

gsap.registerPlugin(useGSAP);

type RectAttrs = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type MainLayout = {
  fullHeight: number;
  fullWidth: number;
  insetX: number;
  lineHeight: number;
  lineTop: number;
  mainSurface: RectAttrs;
  separator: RectAttrs;
  topSurface: RectAttrs;
  transitionCenter: RectAttrs;
  transitionFinal: RectAttrs;
  transitionFull: RectAttrs;
};

const LOGICAL_SCREEN_WIDTH = 34;
const LOGICAL_SCREEN_HEIGHT = 19;

function createSnapper(devicePixelRatio: number) {
  return (value: number) => Math.round(value * devicePixelRatio) / devicePixelRatio;
}

function getMainLayout(): MainLayout {
  const fullWidth = window.innerWidth;
  const fullHeight = window.innerHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const snap = createSnapper(devicePixelRatio);
  const cmX = fullWidth / LOGICAL_SCREEN_WIDTH;
  const cmY = fullHeight / LOGICAL_SCREEN_HEIGHT;
  const lineHeight = snap(2 / devicePixelRatio);
  const y1 = snap(2 * cmY);
  const y2 = snap(fullHeight / 2);
  const insetX = snap(2 * cmX);
  const lineTop = snap(y1 - lineHeight / 2);
  const lineBottom = snap(lineTop + lineHeight);
  const centerLineTop = snap(y2 - lineHeight / 2);
  const finalWidth = Math.max(snap(fullWidth - insetX * 2), lineHeight);

  return {
    fullHeight,
    fullWidth,
    insetX,
    lineHeight,
    lineTop,
    topSurface: {
      x: 0,
      y: 0,
      width: fullWidth,
      height: Math.max(lineTop, 0),
    },
    separator: {
      x: insetX,
      y: lineTop,
      width: finalWidth,
      height: lineHeight,
    },
    mainSurface: {
      x: 0,
      y: lineBottom,
      width: fullWidth,
      height: Math.max(fullHeight - lineBottom, 0),
    },
    transitionFull: {
      x: 0,
      y: 0,
      width: fullWidth,
      height: fullHeight,
    },
    transitionCenter: {
      x: 0,
      y: centerLineTop,
      width: fullWidth,
      height: lineHeight,
    },
    transitionFinal: {
      x: insetX,
      y: lineTop,
      width: finalWidth,
      height: lineHeight,
    },
  };
}

function setRectAttrs(rect: SVGRectElement, attrs: RectAttrs) {
  gsap.set(rect, {
    attr: attrs,
  });
}

export function MainWindow() {
  const rootRef = useRef<HTMLElement>(null);
  const topSurfaceRef = useRef<SVGRectElement>(null);
  const mainSurfaceRef = useRef<SVGRectElement>(null);
  const separatorRef = useRef<SVGRectElement>(null);
  const transitionBlueRef = useRef<SVGRectElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const topSurface = topSurfaceRef.current;
      const mainSurface = mainSurfaceRef.current;
      const separator = separatorRef.current;
      const transitionBlue = transitionBlueRef.current;

      if (!root || !topSurface || !mainSurface || !separator || !transitionBlue) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let introTimeline: gsap.core.Timeline | null = null;
      let hasSettled = false;

      const renderSurfaceLayout = (layout: MainLayout) => {
        setRectAttrs(topSurface, layout.topSurface);
        setRectAttrs(mainSurface, layout.mainSurface);
      };

      const renderSettledLayout = (layout = getMainLayout()) => {
        renderSurfaceLayout(layout);
        setRectAttrs(separator, layout.separator);
        setRectAttrs(transitionBlue, layout.transitionFinal);
        gsap.set(separator, { autoAlpha: 1 });
        gsap.set(transitionBlue, { autoAlpha: 0 });
        root.setAttribute("data-main-window-stage", "settled");
      };

      const renderInitialLayout = (layout = getMainLayout()) => {
        renderSurfaceLayout(layout);
        setRectAttrs(separator, layout.separator);
        setRectAttrs(transitionBlue, layout.transitionFull);
        gsap.set(separator, { autoAlpha: 0 });
        gsap.set(transitionBlue, { autoAlpha: 1 });
        root.setAttribute("data-main-window-stage", "intro");
      };

      const playIntro = () => {
        introTimeline?.kill();
        const layout = getMainLayout();

        if (prefersReducedMotion) {
          hasSettled = true;
          renderSettledLayout(layout);
          return;
        }

        hasSettled = false;
        renderInitialLayout(layout);

        introTimeline = gsap.timeline({
          onComplete: () => {
            hasSettled = true;
            renderSettledLayout(getMainLayout());
            introTimeline = null;
          },
        });

        introTimeline
          .to(
            transitionBlue,
            {
              attr: layout.transitionCenter,
              duration: 0.4,
              ease: LINE_DRAW_EASE,
            },
            0.2,
          )
          .to(
            transitionBlue,
            {
              attr: layout.transitionFinal,
              duration: 0.4,
              ease: LINE_DRAW_EASE,
            },
            1,
          );
      };

      const handleResize = () => {
        if (hasSettled || prefersReducedMotion) {
          renderSettledLayout();
          return;
        }

        playIntro();
      };

      playIntro();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        introTimeline?.kill();
        gsap.killTweensOf([transitionBlue, separator, topSurface, mainSurface]);
      };
    },
    { scope: rootRef },
  );

  return (
    <main ref={rootRef} className="main-window" data-main-window-stage="intro">
      <svg className="main-window-svg" aria-hidden="true" focusable="false">
        <rect ref={topSurfaceRef} className="main-window-surface" x={0} y={0} width={0} height={0} />
        <rect ref={mainSurfaceRef} className="main-window-surface" x={0} y={0} width={0} height={0} />
        <rect
          ref={separatorRef}
          className="main-window-separator"
          x={0}
          y={0}
          width={0}
          height={0}
          shapeRendering="crispEdges"
        />
        <rect
          ref={transitionBlueRef}
          className="main-window-transition-blue"
          x={0}
          y={0}
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        />
      </svg>
    </main>
  );
}
