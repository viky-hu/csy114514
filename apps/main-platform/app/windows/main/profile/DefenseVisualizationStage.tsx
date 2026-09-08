"use client";

import { useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  DEFAULT_DEFENSE_DISPLAY_INDEX,
  DEFENSE_DISPLAY_ITEMS,
  getDefenseCanonicalIndexFromDisplayItemIndex,
  getDefenseLayer,
} from "./defense-visualization-data";
import { DefenseFlow } from "./DefenseFlow";
import { D1InputFilterPanel } from "./D1InputFilterPanel";
import { D2InstructionIsolationPanel } from "./D2InstructionIsolationPanel";
import { D3CausalChainPanel } from "./D3CausalChainPanel";
import { D4IntentClassifierPanel } from "./D4IntentClassifierPanel";
import { D5MemoryAuditorPanel } from "./D5MemoryAuditorPanel";
import { D6SessionMonitorPanel } from "./D6SessionMonitorPanel";
import { D7OutputFilterPanel } from "./D7OutputFilterPanel";
import { D8ConfirmationGatePanel } from "./D8ConfirmationGatePanel";
import { LLMToolCallBridgePanel } from "./LLMToolCallBridgePanel";

type DefenseVisualizationStageProps = {
  isVisible: boolean;
  onReturn: () => void;
};

export function DefenseVisualizationStage({
  isVisible,
  onReturn,
}: DefenseVisualizationStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const placeholderRef = useRef<HTMLElement>(null);
  const navigationDirectionRef = useRef<1 | -1>(1);
  const [selectedDisplayIndex, setSelectedDisplayIndex] = useState(
    DEFAULT_DEFENSE_DISPLAY_INDEX,
  );

  useGSAP(
    () => {
      const placeholderRoot = placeholderRef.current;
      if (!placeholderRoot) {
        return;
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const activePlaceholder = placeholderRoot.querySelector<HTMLElement>(
        ".security-defense-placeholder",
      );
      if (!activePlaceholder) return;

      gsap.killTweensOf(activePlaceholder);
      gsap.set(activePlaceholder, {
        autoAlpha: 0,
        x: navigationDirectionRef.current * 16,
      });

      if (reducedMotion || !isVisible) {
        gsap.set(activePlaceholder, { autoAlpha: isVisible ? 1 : 0, x: 0 });
        return;
      }

      gsap.to(activePlaceholder, {
        autoAlpha: 1,
        duration: 0.22,
        ease: "power2.out",
        x: 0,
        overwrite: "auto",
      });
    },
    {
      dependencies: [isVisible, selectedDisplayIndex],
      scope: stageRef,
      revertOnUpdate: false,
    },
  );

  const selectedDisplayItem = DEFENSE_DISPLAY_ITEMS[selectedDisplayIndex]!;
  const activeCanonicalIndex = getDefenseCanonicalIndexFromDisplayItemIndex(
    selectedDisplayIndex,
  );
  const activeLayer =
    activeCanonicalIndex === null ? null : getDefenseLayer(activeCanonicalIndex);
  const canGoPrevious = selectedDisplayIndex > 0;
  const canGoNext = selectedDisplayIndex < DEFENSE_DISPLAY_ITEMS.length - 1;
  const getDisplayItemAriaLabel = (displayIndex: number) => {
    const item = DEFENSE_DISPLAY_ITEMS[displayIndex];
    if (!item) return "无";
    return item.kind === "bridge"
      ? `BRIDGE ${item.label}`
      : `${item.displayId} ${item.label}`;
  };
  const moveToDisplayIndex = (displayIndex: number) => {
    const boundedIndex = Math.min(
      Math.max(displayIndex, 0),
      DEFENSE_DISPLAY_ITEMS.length - 1,
    );
    if (boundedIndex === selectedDisplayIndex) return;
    navigationDirectionRef.current =
      boundedIndex > selectedDisplayIndex ? 1 : -1;
    setSelectedDisplayIndex(boundedIndex);
  };

  return (
    <section
      ref={stageRef}
      className={`security-profile-defense-screen security-defense-screen${
        isVisible ? " is-revealed" : ""
      }`}
      aria-label="防御机制可视化"
      aria-hidden={!isVisible}
    >
      <div className="security-defense-region">
        <button
          className="security-defense-return"
          type="button"
          aria-label="返回安全画像"
          title="返回安全画像"
          onClick={onReturn}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <DefenseFlow
          selectedDisplayIndex={selectedDisplayIndex}
          isVisible={isVisible}
        />
        <div className="security-defense-workspace">
          <button
            className="security-defense-step-button security-defense-step-button-previous"
            type="button"
            aria-label={`上一层：${
              selectedDisplayIndex > 0
                ? getDisplayItemAriaLabel(selectedDisplayIndex - 1)
                : "无"
            }`}
            disabled={!canGoPrevious}
            onClick={() => moveToDisplayIndex(selectedDisplayIndex - 1)}
          >
            <ChevronLeft size={30} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <section
            ref={placeholderRef}
            className="security-defense-content"
            tabIndex={0}
            aria-label={`${getDisplayItemAriaLabel(selectedDisplayIndex)}详情`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft" && canGoPrevious) {
                event.preventDefault();
                moveToDisplayIndex(selectedDisplayIndex - 1);
              }
              if (event.key === "ArrowRight" && canGoNext) {
                event.preventDefault();
                moveToDisplayIndex(selectedDisplayIndex + 1);
              }
            }}
          >
            <div
              key={selectedDisplayIndex}
              className={`security-defense-placeholder${activeLayer?.id === "D1" ? " is-d1" : ""}${selectedDisplayItem.kind === "layer" && selectedDisplayItem.displayId === "D2" ? " is-d2" : ""}${selectedDisplayItem.kind === "layer" && selectedDisplayItem.displayId !== "D1" ? " is-detail" : ""}${selectedDisplayItem.kind === "bridge" ? " is-bridge" : ""}`}
              data-defense-layer={activeLayer?.id}
              data-defense-display-index={selectedDisplayIndex}
              data-defense-bridge={selectedDisplayItem.kind === "bridge" ? selectedDisplayItem.id : undefined}
            >
              {selectedDisplayItem.kind === "bridge" ? (
                <LLMToolCallBridgePanel
                  isVisible={isVisible}
                  onSelectDisplayIndex={moveToDisplayIndex}
                />
              ) : activeLayer?.id === "D1" ? (
                <D1InputFilterPanel
                  isVisible={isVisible}
                />
              ) : selectedDisplayItem.displayId === "D2" ? (
                <D2InstructionIsolationPanel isVisible={isVisible} />
              ) : selectedDisplayItem.displayId === "D3" ? (
                <D3CausalChainPanel isVisible={isVisible} />
              ) : selectedDisplayItem.displayId === "D4" ? (
                <D4IntentClassifierPanel isVisible={isVisible} />
              ) : selectedDisplayItem.displayId === "D5" ? (
                <D5MemoryAuditorPanel isVisible={isVisible} />
              ) : selectedDisplayItem.displayId === "D6" ? (
                <D6SessionMonitorPanel isVisible={isVisible} />
              ) : selectedDisplayItem.displayId === "D7" ? (
                <D7OutputFilterPanel isVisible={isVisible} />
              ) : (
                <D8ConfirmationGatePanel isVisible={isVisible} />
              )}
            </div>
          </section>
          <button
            className="security-defense-step-button security-defense-step-button-next"
            type="button"
            aria-label={`下一层：${
              selectedDisplayIndex < DEFENSE_DISPLAY_ITEMS.length - 1
                ? getDisplayItemAriaLabel(selectedDisplayIndex + 1)
                : "无"
            }`}
            disabled={!canGoNext}
            onClick={() => moveToDisplayIndex(selectedDisplayIndex + 1)}
          >
            <ChevronRight size={30} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
