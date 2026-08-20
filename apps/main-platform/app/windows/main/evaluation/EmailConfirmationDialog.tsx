"use client";

import { useEffect, useRef } from "react";
import type { EmailConfirmation, EmailConfirmationDecision } from "./email-confirmation";

export function EmailConfirmationDialog({
  confirmation,
  onDecision,
}: {
  confirmation: EmailConfirmation | null;
  onDecision: (eventId: string, decision: EmailConfirmationDecision) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmation) return;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstActionRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDecision(confirmation.eventId, "dismissed");
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
      if (previousActiveElement?.isConnected) previousActiveElement.focus();
    };
  }, [confirmation, onDecision]);

  if (!confirmation) return null;

  const decide = (decision: EmailConfirmationDecision) => onDecision(confirmation.eventId, decision);
  return (
    <div className="evaluation-confirmation-backdrop">
      <div ref={dialogRef} className="evaluation-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="evaluation-confirmation-title">
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
