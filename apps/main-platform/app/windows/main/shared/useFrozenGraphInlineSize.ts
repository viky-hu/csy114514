"use client";

import {
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

export type SidebarContentMetrics = {
  collapsedInlineSize: number;
  openInlineSize: number;
};

type FrozenGraphLayout = "split" | "stacked";

type FrozenGraphInlineSizeOptions = {
  collapsedContentInlineSize: number;
  fallbackOpenInlineSize: number;
  gap: number;
  graphRef: RefObject<HTMLElement | null>;
  isGraphFrozen: boolean;
  minCompanionInlineSize: number;
  shouldStack: boolean;
};

type FrozenGraphStyle = CSSProperties &
  Record<"--sidebar-frozen-graph-inline-size", string>;

function normalizeInlineSize(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function useFrozenGraphInlineSize({
  collapsedContentInlineSize,
  fallbackOpenInlineSize,
  gap,
  graphRef,
  isGraphFrozen,
  minCompanionInlineSize,
  shouldStack,
}: FrozenGraphInlineSizeOptions) {
  const [measuredOpenInlineSize, setMeasuredOpenInlineSize] = useState<
    number | null
  >(null);

  useLayoutEffect(() => {
    if (isGraphFrozen) {
      return;
    }

    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const nextInlineSize = normalizeInlineSize(
        graph.getBoundingClientRect().width,
      );

      setMeasuredOpenInlineSize((currentInlineSize) =>
        currentInlineSize !== null &&
        Math.abs(currentInlineSize - nextInlineSize) < 0.5
          ? currentInlineSize
          : nextInlineSize,
      );
    };
    const scheduleMeasure = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(measure);
    };

    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(graph);

    return () => {
      observer.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [graphRef, isGraphFrozen]);

  const frozenInlineSize = normalizeInlineSize(
    measuredOpenInlineSize ?? fallbackOpenInlineSize,
  );
  const layout: FrozenGraphLayout = shouldStack ||
    frozenInlineSize + gap + minCompanionInlineSize >
      collapsedContentInlineSize
    ? "stacked"
    : "split";
  const graphStyle = useMemo<FrozenGraphStyle>(
    () => ({
      "--sidebar-frozen-graph-inline-size": `${frozenInlineSize}px`,
    }),
    [frozenInlineSize],
  );

  return {
    graphStyle,
    layout,
  };
}
