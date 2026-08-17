"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound, LoaderCircle, X } from "lucide-react";
import { validatePasswordForm, type PasswordForm } from "./account-settings";
import { accountRepository } from "./account-repository";

type AccountPasswordDialogProps = {
  onClose: () => void;
  onSuccess: () => void;
};

const EMPTY_FORM: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function AccountPasswordDialog({ onClose, onSuccess }: AccountPasswordDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const [form, setForm] = useState<PasswordForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    firstInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled])",
        ),
      );
      if (focusable.length === 0) {
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
        : currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateField = (field: keyof PasswordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validatePasswordForm(form);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await accountRepository.changePassword(form);
      onSuccess();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "密码修改失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="account-settings-dialog-layer" role="presentation">
      <button
        aria-label="关闭密码修改窗口"
        className="account-settings-dialog-backdrop"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        type="button"
      />
      <div
        ref={dialogRef}
        aria-labelledby="account-password-dialog-title"
        aria-modal="true"
        className="account-settings-dialog"
        role="dialog"
      >
        <header className="account-settings-dialog-header">
          <div>
            <span className="account-settings-dialog-eyebrow">ACCOUNT SECURITY</span>
            <h2 id="account-password-dialog-title"><KeyRound size={17} /> 修改访问密码</h2>
          </div>
          <button
            aria-label="关闭密码修改窗口"
            className="account-settings-dialog-close"
            disabled={isSubmitting}
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <form className="account-settings-dialog-form" onSubmit={submit}>
          <label>
            <span>当前密码</span>
            <input
              ref={firstInputRef}
              autoComplete="current-password"
              disabled={isSubmitting}
              type="password"
              value={form.currentPassword}
              onChange={(event) => updateField("currentPassword", event.target.value)}
            />
          </label>
          <label>
            <span>新密码</span>
            <input
              autoComplete="new-password"
              disabled={isSubmitting}
              type="password"
              value={form.newPassword}
              onChange={(event) => updateField("newPassword", event.target.value)}
            />
          </label>
          <label>
            <span>确认新密码</span>
            <input
              autoComplete="new-password"
              disabled={isSubmitting}
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
            />
          </label>
          {error ? <p className="account-settings-inline-error" role="alert">{error}</p> : null}
          <div className="account-settings-dialog-actions">
            <button className="account-settings-secondary-button" disabled={isSubmitting} onClick={onClose} type="button">取消</button>
            <button className="account-settings-primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? <LoaderCircle aria-hidden="true" className="is-spinning" size={16} /> : <KeyRound aria-hidden="true" size={16} />}
              {isSubmitting ? "修改中" : "确认修改"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
