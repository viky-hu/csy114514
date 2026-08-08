"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type MainLineSidebarItem = {
  english: string;
  key: string;
  label: string;
};

type MainLineSidebarProps = {
  activeKey: string;
  itemGap?: number;
  items: MainLineSidebarItem[];
  markerLength?: number;
  maxShift?: number;
  onSelect: (item: MainLineSidebarItem) => void;
  proximityRadius?: number;
  smoothing?: number;
};

type SidebarStyle = CSSProperties & {
  "--main-sidebar-item-gap": string;
  "--main-sidebar-marker-length": string;
  "--main-sidebar-max-shift": string;
};

type SidebarItemStyle = CSSProperties & {
  "--nav-effect": string;
};

const EFFECT_SETTLE_THRESHOLD = 0.001;

function getSmoothFalloff(distance: number, radius: number) {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }

  const progress = distance / radius;
  return 1 - progress * progress * (3 - 2 * progress);
}

function formatIndex(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function MainLineSidebar({
  activeKey,
  itemGap = 42,
  items,
  markerLength = 72,
  maxShift = 18,
  onSelect,
  proximityRadius = 140,
  smoothing = 120,
}: MainLineSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const targetEffects = useRef<number[]>([]);
  const currentEffects = useRef<number[]>([]);
  const rafId = useRef<number | null>(null);
  const lastFrameTime = useRef<number | null>(null);
  const stepEffectsRef = useRef<(timestamp: number) => void>(() => undefined);

  const sidebarStyle = useMemo<SidebarStyle>(
    () => ({
      "--main-sidebar-item-gap": `${itemGap}px`,
      "--main-sidebar-marker-length": `${markerLength}px`,
      "--main-sidebar-max-shift": `${maxShift}px`,
    }),
    [itemGap, markerLength, maxShift],
  );

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
    buttonRefs.current = buttonRefs.current.slice(0, items.length);
    targetEffects.current = Array.from(
      { length: items.length },
      (_, index) => targetEffects.current[index] ?? 0,
    );
    currentEffects.current = Array.from(
      { length: items.length },
      (_, index) => currentEffects.current[index] ?? 0,
    );

    return () => {
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [items.length]);

  const stepEffects = useCallback(
    (timestamp: number) => {
      const previousTime = lastFrameTime.current ?? timestamp;
      const elapsedSeconds = Math.max(timestamp - previousTime, 0) / 1000;
      const tau = Math.max(smoothing, 1) / 1000;
      const blend = 1 - Math.exp(-elapsedSeconds / tau);
      let isSettled = true;

      lastFrameTime.current = timestamp;

      for (let index = 0; index < items.length; index += 1) {
        const target = targetEffects.current[index] ?? 0;
        const current = currentEffects.current[index] ?? 0;
        const next = current + (target - current) * blend;
        const settledNext =
          Math.abs(target - next) < EFFECT_SETTLE_THRESHOLD ? target : next;
        const item = itemRefs.current[index];

        currentEffects.current[index] = settledNext;
        item?.style.setProperty("--nav-effect", settledNext.toFixed(4));

        if (Math.abs(target - settledNext) >= EFFECT_SETTLE_THRESHOLD) {
          isSettled = false;
        }
      }

      if (isSettled) {
        rafId.current = null;
        lastFrameTime.current = null;
        return;
      }

      rafId.current = window.requestAnimationFrame(stepEffectsRef.current);
    },
    [items.length, smoothing],
  );

  useEffect(() => {
    stepEffectsRef.current = stepEffects;
  }, [stepEffects]);

  const startEffectLoop = useCallback(() => {
    if (rafId.current !== null) {
      return;
    }

    lastFrameTime.current = null;
    rafId.current = window.requestAnimationFrame(stepEffectsRef.current);
  }, []);

  const setTargets = useCallback(
    (getTarget: (index: number) => number) => {
      for (let index = 0; index < items.length; index += 1) {
        targetEffects.current[index] = getTarget(index);
      }

      startEffectLoop();
    },
    [items.length, startEffectLoop],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLUListElement>) => {
      const list = listRef.current;

      if (!list) {
        return;
      }

      const listRect = list.getBoundingClientRect();
      const pointerY = event.clientY - listRect.top;

      setTargets((index) => {
        const item = itemRefs.current[index];

        if (!item) {
          return 0;
        }

        const itemRect = item.getBoundingClientRect();
        const itemCenterY = itemRect.top - listRect.top + itemRect.height / 2;
        return getSmoothFalloff(
          Math.abs(pointerY - itemCenterY),
          proximityRadius,
        );
      });
    },
    [proximityRadius, setTargets],
  );

  const handlePointerLeave = useCallback(() => {
    setTargets(() => 0);
  }, [setTargets]);

  const handleItemFocus = useCallback(
    (focusedIndex: number) => {
      setTargets((index) => (index === focusedIndex ? 1 : 0));
    },
    [setTargets],
  );

  const handleItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = items.length - 1;
      let nextIndex = index;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        nextIndex = index === lastIndex ? 0 : index + 1;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        nextIndex = index === 0 ? lastIndex : index - 1;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = lastIndex;
      } else {
        return;
      }

      event.preventDefault();
      buttonRefs.current[nextIndex]?.focus();
    },
    [items.length],
  );

  return (
    <nav
      aria-label="主页面导航"
      className="main-line-sidebar"
      style={sidebarStyle}
    >
      <ul
        ref={listRef}
        className="main-line-sidebar-list"
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
      >
        {items.map((item, index) => {
          const isActive = item.key === activeKey;

          return (
            <li
              key={item.key}
              ref={(node) => {
                itemRefs.current[index] = node;
                node?.style.setProperty("--nav-effect", "0");
              }}
              className={`main-line-sidebar-item${isActive ? " is-active" : ""}`}
              style={{ "--nav-effect": "0" } as SidebarItemStyle}
            >
              <button
                ref={(node) => {
                  buttonRefs.current[index] = node;
                }}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${item.label} ${item.english}`}
                className="main-line-sidebar-button"
                onBlur={handlePointerLeave}
                onClick={() => onSelect(item)}
                onFocus={() => handleItemFocus(index)}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
                type="button"
              >
                <span className="main-line-sidebar-marker" aria-hidden="true" />
                <span className="main-line-sidebar-copy">
                  <span className="main-line-sidebar-meta">
                    <span>{formatIndex(index)}</span>
                    <span>{item.english}</span>
                  </span>
                  <span className="main-line-sidebar-label-wrap">
                    <span className="main-line-sidebar-label-base">
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="main-line-sidebar-label-gradient"
                    >
                      {item.label}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
