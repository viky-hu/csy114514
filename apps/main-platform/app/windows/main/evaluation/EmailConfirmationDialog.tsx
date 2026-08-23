"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EmailConfirmation, EmailConfirmationDecision } from "./email-confirmation";

const CONFIRMATION_EXIT_DURATION_MS = 180;

export function EmailConfirmationDialog({
  confirmation,
  onDecision,
}: {
  confirmation: EmailConfirmation | null;
  onDecision: (eventId: string, decision: EmailConfirmationDecision) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const exitTimerRef = useRef<number | null>(null);
  const isExitingRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current === null) return;
    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }, []);

  const decide = useCallback((decision: EmailConfirmationDecision) => {
    if (!confirmation || isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);
    const eventId = confirmation.eventId;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : CONFIRMATION_EXIT_DURATION_MS;
    clearExitTimer();
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      onDecision(eventId, decision);
    }, duration);
  }, [clearExitTimer, confirmation, onDecision]);

  useEffect(() => {
    isExitingRef.current = false;
    setIsExiting(false);
    clearExitTimer();
    if (!confirmation) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstActionRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        decide("dismissed");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearExitTimer();
      if (previousActiveElement?.isConnected) previousActiveElement.focus();
    };
  }, [clearExitTimer, confirmation, decide]);

  if (!confirmation) return null;

  return (
    <div className={`evaluation-confirmation-backdrop${isExiting ? " is-exiting" : ""}`}>
      <div ref={dialogRef} className={`evaluation-confirmation-dialog${isExiting ? " is-exiting" : ""}`} role="dialog" aria-modal="true" aria-labelledby="evaluation-confirmation-title">
        <span className="evaluation-eyebrow">TOOL CONFIRMATION</span>
        <h2 id="evaluation-confirmation-title">Agent 请求发送邮件</h2>
        <p>Agent 想要发送邮件到 <strong>{confirmation.recipient}</strong>，是否允许？</p>
        <div className="evaluation-confirmation-actions">
          <button ref={firstActionRef} type="button" className="evaluation-confirmation-allow" onClick={() => decide("allowed")}>允许</button>
          <button type="button" className="evaluation-secondary-button" onClick={() => decide("denied")}>拒绝</button>
          <button type="button" className="evaluation-icon-command" title="关闭确认弹窗" aria-label="关闭确认弹窗" onClick={() => decide("dismissed")}>×</button>
        </div>
      </div>
    </div>
  );
}
