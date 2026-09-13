"use client";

import type { RefObject } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type DrawSVGTweenVars = gsap.TweenVars & { drawSVG?: string };

type GraphNodeHoverOutlineOptions = {
  activeNodeId: string | null;
  nodeKey: string;
  nodeSelector?: string;
  outlineSelector?: string;
  rootRef: RefObject<HTMLElement | null>;
};

export function useGraphNodeHoverOutline({
  activeNodeId,
  nodeKey,
  nodeSelector = ".graph-hover-node",
  outlineSelector = ".graph-hover-outline",
  rootRef,
}: GraphNodeHoverOutlineOptions) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const nodes = gsap.utils.toArray<SVGGElement>(nodeSelector, root);
      const outlines = gsap.utils.toArray<SVGPathElement>(
        outlineSelector,
        root,
      );
      const activeNode = nodes.find(
        (node) => node.dataset.hoverNodeId === activeNodeId,
      );
      const activeOutline = activeNode?.querySelector<SVGPathElement>(
        outlineSelector,
      );

      gsap.killTweensOf([...nodes, ...outlines]);
      // Never scale an SVG <g> on hover. Its fill-box includes text and icons,
      // so the computed center differs per node and visibly pulls nodes toward
      // unrelated pivots. A uniform vertical lift preserves every route anchor.
      gsap.set(nodes, { y: 0 });
      gsap.set(outlines, {
        autoAlpha: 0,
        drawSVG: "0% 0%",
      } as DrawSVGTweenVars);

      if (!activeNode || !activeOutline) return;

      gsap.to(activeNode, {
        duration: reduceMotion ? 0 : 0.24,
        ease: "power2.out",
        overwrite: "auto",
        y: -5,
      });
      gsap.fromTo(
        activeOutline,
        { autoAlpha: 1, drawSVG: "0% 0%" } as DrawSVGTweenVars,
        {
          autoAlpha: 1,
          drawSVG: "0% 100%",
          duration: reduceMotion ? 0 : 0.48,
          ease: "power2.inOut",
          overwrite: "auto",
        } as DrawSVGTweenVars,
      );
    },
    {
      dependencies: [activeNodeId, nodeKey, nodeSelector, outlineSelector],
      revertOnUpdate: true,
      scope: rootRef,
    },
  );
}
