"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { DefenseLayer } from "./defense-visualization-data";
import {
  getDefenseWheelItemFrame,
  resolveDefenseWheelLoopTarget,
  resolveDefenseWheelSelection,
  resolveDefenseWheelTarget,
} from "./defense-option-wheel-model";

type DefenseOptionWheelStyle = CSSProperties &
  Record<
    "--ow-font-size" | "--ow-active-color" | "--ow-text-color" | "--ow-inset",
    string
  >;

export type DefenseOptionWheelProps = {
  items: readonly DefenseLayer[];
  defaultSelected?: number;
  selectedIndex?: number;
  textColor?: string;
  activeColor?: string;
  side?: "left" | "right";
  fontSize?: number;
  spacing?: number;
  curve?: number;
  tilt?: number;
  blur?: number;
  fade?: number;
  minOpacity?: number;
  smoothing?: number;
  inset?: number;
  loop?: boolean;
  draggable?: boolean;
  reducedMotion?: boolean;
  soundUrl?: string;
  soundVolume?: number;
  onChange?: (index: number, item: DefenseLayer) => void;
};

const DRAG_THRESHOLD = 4;

export function DefenseOptionWheel({
  items,
  defaultSelected = 0,
  selectedIndex: selectedIndexProp,
  textColor = "rgba(31, 41, 61, 0.64)",
  activeColor = "#3152f4",
  side = "left",
  fontSize = 0.82,
  spacing = 2.9,
  curve = 1,
  tilt = 6,
  blur = 1.2,
  fade = 0.24,
  minOpacity = 0.08,
  smoothing = 200,
  inset = 10,
  loop = false,
  draggable = true,
  reducedMotion = false,
  soundUrl,
  soundVolume = 0.35,
  onChange,
}: DefenseOptionWheelProps) {
  const itemCount = items.length;
  const initialIndex = resolveDefenseWheelTarget(
    selectedIndexProp ?? defaultSelected,
    itemCount,
  );
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(initialIndex);
  const selectedIndex =
    selectedIndexProp === undefined
      ? internalSelectedIndex
      : resolveDefenseWheelTarget(selectedIndexProp, itemCount);
  const [mediaReducedMotion, setMediaReducedMotion] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const selectedIndexRef = useRef(initialIndex);
  const controlledIndexRef = useRef<number | null>(
    selectedIndexProp === undefined ? null : initialIndex,
  );
  const positionRef = useRef(initialIndex);
  const targetPositionRef = useRef(initialIndex);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const rowHeightRef = useRef(Math.max(fontSize * spacing * 16, 1));
  const pointerRef = useRef({ id: -1, startY: 0, startPosition: initialIndex });
  const dragMovedRef = useRef(false);
  const soundRef = useRef<HTMLAudioElement | null>(null);
  const shouldReduceMotion = reducedMotion || mediaReducedMotion;

  const getSelectionIndex = useCallback(
    (position: number) => {
      if (itemCount === 0) {
        return 0;
      }
      const rounded = Math.round(position);
      return loop
        ? ((rounded % itemCount) + itemCount) % itemCount
        : resolveDefenseWheelTarget(rounded, itemCount);
    },
    [itemCount, loop],
  );

  const notifySelection = useCallback(
    (nextIndex: number) => {
      const index = getSelectionIndex(nextIndex);
      selectedIndexRef.current = index;
      if (selectedIndexProp !== undefined) {
        controlledIndexRef.current = index;
      }
      setInternalSelectedIndex((current) => (current === index ? current : index));
      onChange?.(index, items[index]!);
    },
    [getSelectionIndex, items, onChange, selectedIndexProp],
  );

  const playTick = useCallback(() => {
    if (!soundRef.current) {
      if (!soundUrl || typeof Audio === "undefined") {
        return;
      }

      soundRef.current = new Audio(soundUrl);
      soundRef.current.volume = soundVolume;
    }

    soundRef.current.currentTime = 0;
    void soundRef.current.play().catch(() => undefined);
  }, [soundUrl, soundVolume]);

  const renderPosition = useCallback(
    (position: number) => {
      if (itemCount === 0) {
        return;
      }

      const rowHeight = rowHeightRef.current;
      itemRefs.current.forEach((item, index) => {
        if (!item) {
          return;
        }

        let distance = index - position;
        if (loop && itemCount > 1) {
          distance = ((distance % itemCount) + itemCount) % itemCount;
          if (distance > itemCount / 2) {
            distance -= itemCount;
          }
        }

        const frame = getDefenseWheelItemFrame({
          curve,
          distance,
          fade,
          index,
          minOpacity,
          position,
          rowHeight,
          side,
          tilt,
        });

        item.style.transform = `translate(${frame.x.toFixed(3)}px, calc(${frame.y.toFixed(3)}px - 50%)) rotate(${frame.rotation.toFixed(3)}deg)`;
        item.style.opacity = String(frame.opacity);
        item.style.filter = blur > 0 ? `blur(${(frame.blur * blur).toFixed(3)}px)` : "none";
        item.style.setProperty("--ow-distance", String(distance));
        item.style.setProperty(
          "--ow-p",
          Math.max(0, 1 - Math.min(Math.abs(distance), 1)).toFixed(4),
        );
      });
    },
    [blur, curve, fade, itemCount, loop, minOpacity, side, tilt],
  );

  const requestPosition = useCallback(
    (nextPosition: number, shouldNotify = true, snap = false) => {
      if (itemCount === 0) {
        return;
      }

      const boundedTarget = loop
        ? nextPosition
        : resolveDefenseWheelTarget(nextPosition, itemCount);
      const target = snap
        ? loop
          ? Math.round(boundedTarget)
          : resolveDefenseWheelSelection(boundedTarget, itemCount)
        : boundedTarget;
      targetPositionRef.current = target;
      const nextIndex = getSelectionIndex(target);
      const selectionChanged = nextIndex !== selectedIndexRef.current;

      if (shouldReduceMotion) {
        positionRef.current = target;
        renderPosition(target);
        if (shouldNotify && selectionChanged) {
          notifySelection(nextIndex);
          playTick();
        }
        return;
      }

      if (shouldNotify && selectionChanged) {
        notifySelection(nextIndex);
        playTick();
      }

      if (rafRef.current !== null) {
        return;
      }

      lastFrameTimeRef.current = null;
      rafRef.current = requestAnimationFrame(function tick(now) {
        const previous = lastFrameTimeRef.current ?? now;
        const delta = Math.min(now - previous, 50);
        lastFrameTimeRef.current = now;
        const tau = Math.max(smoothing, 1) / 1000;
        const smoothingFactor = 1 - Math.exp(-(delta / 1000) / tau);
        const current = positionRef.current;
        const targetPosition = targetPositionRef.current;
        const next = current + (targetPosition - current) * smoothingFactor;

        positionRef.current = next;
        renderPosition(next);

        if (Math.abs(targetPosition - next) < 0.001) {
          positionRef.current = targetPosition;
          renderPosition(targetPosition);
          rafRef.current = null;
          lastFrameTimeRef.current = null;
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      });
    },
    [
      getSelectionIndex,
      itemCount,
      loop,
      notifySelection,
      playTick,
      renderPosition,
      shouldReduceMotion,
      smoothing,
    ],
  );

  const commitPosition = useCallback(() => {
    const nextPosition = loop
      ? Math.round(targetPositionRef.current)
      : resolveDefenseWheelSelection(targetPositionRef.current, itemCount);
    requestPosition(nextPosition, true, true);
  }, [itemCount, loop, requestPosition]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setMediaReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    rowHeightRef.current = Math.max(fontSize * spacing * remPx, 1);
    renderPosition(positionRef.current);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (wheelTimerRef.current !== null) {
        clearTimeout(wheelTimerRef.current);
      }
      rafRef.current = null;
      wheelTimerRef.current = null;
      soundRef.current?.pause();
    };
  }, [fontSize, renderPosition, spacing]);

  useEffect(() => {
    if (selectedIndexProp === undefined || itemCount === 0) {
      return;
    }
    const nextIndex = resolveDefenseWheelTarget(selectedIndexProp, itemCount);
    if (controlledIndexRef.current === nextIndex) {
      return;
    }

    controlledIndexRef.current = nextIndex;
    selectedIndexRef.current = nextIndex;
    const nextPosition = loop
      ? resolveDefenseWheelLoopTarget(
          targetPositionRef.current,
          nextIndex,
          itemCount,
        )
      : nextIndex;
    requestPosition(nextPosition, false, true);
  }, [itemCount, loop, requestPosition, selectedIndexProp]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (itemCount === 0) {
        return;
      }

      const delta = event.deltaMode === 1 ? event.deltaY * 24 : event.deltaY;
      const step = Math.max(-1, Math.min(1, delta / rowHeightRef.current));
      if (step === 0) {
        return;
      }

      const nextPosition = targetPositionRef.current + step;
      requestPosition(nextPosition, false);

      if (wheelTimerRef.current !== null) {
        clearTimeout(wheelTimerRef.current);
      }
      wheelTimerRef.current = setTimeout(() => {
        commitPosition();
      }, 140);
    },
    [commitPosition, itemCount, requestPosition],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    root.addEventListener("wheel", handleWheel, { passive: false });
    return () => root.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggable) {
        return;
      }
      pointerRef.current = {
        id: event.pointerId,
        startY: event.clientY,
        startPosition: targetPositionRef.current,
      };
      dragMovedRef.current = false;
      setIsDragging(true);
    },
    [draggable],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggable || pointerRef.current.id !== event.pointerId) {
        return;
      }
      const delta = event.clientY - pointerRef.current.startY;
      if (Math.abs(delta) > DRAG_THRESHOLD) {
        dragMovedRef.current = true;
        rootRef.current?.setPointerCapture(event.pointerId);
      }
      if (!dragMovedRef.current) {
        return;
      }

      event.preventDefault();
      const next = pointerRef.current.startPosition - delta / rowHeightRef.current;
      requestPosition(next, false);
    },
    [draggable, requestPosition],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerRef.current.id !== event.pointerId) {
        return;
      }
      if (dragMovedRef.current) {
        commitPosition();
      }
      if (dragMovedRef.current && rootRef.current?.hasPointerCapture(event.pointerId)) {
        rootRef.current.releasePointerCapture(event.pointerId);
      }
      pointerRef.current.id = -1;
      setIsDragging(false);
    },
    [commitPosition],
  );

  const handleItemClick = useCallback(
    (index: number) => {
      if (dragMovedRef.current || itemCount === 0) {
        return;
      }

      if (!loop) {
        requestPosition(index, true, true);
        return;
      }

      const nextPosition = resolveDefenseWheelLoopTarget(
        targetPositionRef.current,
        index,
        itemCount,
      );
      requestPosition(nextPosition, true, true);
    },
    [itemCount, loop, requestPosition],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
      requestPosition(Math.round(targetPositionRef.current) + delta, true, true);
    },
    [requestPosition],
  );

  const style: DefenseOptionWheelStyle = {
    "--ow-active-color": activeColor,
    "--ow-font-size": `${fontSize}rem`,
    "--ow-inset": `${inset}px`,
    "--ow-text-color": textColor,
    padding: 0,
  };

  return (
    <div
      ref={rootRef}
      className={`security-defense-wheel${isDragging ? " is-dragging" : ""}`}
      role="listbox"
      aria-label="防御机制层级选择"
      aria-activedescendant={`security-defense-wheel-option-${selectedIndex}`}
      tabIndex={0}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          id={`security-defense-wheel-option-${index}`}
          className={`security-defense-wheel-item is-side-${side}${selectedIndex === index ? " is-selected" : ""}`}
          role="option"
          aria-selected={selectedIndex === index}
          onClick={() => handleItemClick(index)}
        >
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
