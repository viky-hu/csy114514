"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Check, CircleUserRound, LoaderCircle, LogOut, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { clearEvaluationWorkspaceSession } from "../evaluation/evaluation-session";
import {
  areProfileValuesDirty,
  getAccountStatusMessage,
  normalizeAccountProfile,
  validateAvatarFile,
  type AccountProfile,
} from "./account-settings";
import { accountRepository, getStoredAccountToken } from "./account-repository";
import { AccountAvatarCropDialog } from "./AccountAvatarCropDialog";
import { AccountPasswordDialog } from "./AccountPasswordDialog";

gsap.registerPlugin(useGSAP);

export type AccountIdentity = {
  username: string;
  role?: string;
  nodeType?: string;
};

type AccountSettingsWorkspaceProps = {
  fallbackIdentity?: AccountIdentity | null;
  onLogout: () => void;
};

function createFallbackProfile(identity?: AccountIdentity | null) {
  return normalizeAccountProfile({
    username: identity?.username || "mock-evaluator",
    role: identity?.role || "evaluator",
    node_type: identity?.nodeType || null,
  });
}

function roleLabel(role: string | null) {
  if (role === "admin") return "管理员";
  if (role === "evaluator") return "评估用户";
  return role || "未提供";
}

function nodeTypeLabel(nodeType: string | null) {
  if (nodeType === "center") return "中心节点";
  if (nodeType === "edge") return "边缘节点";
  return nodeType || "未提供";
}

export function AccountSettingsWorkspace({ fallbackIdentity, onLogout }: AccountSettingsWorkspaceProps) {
  const pageRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftAvatarUrlRef = useRef<string | null>(null);
  const fallback = useMemo(() => createFallbackProfile(fallbackIdentity), [fallbackIdentity]);
  const [profile, setProfile] = useState<AccountProfile>(fallback);
  const [displayName, setDisplayName] = useState(fallback.displayName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(fallback.avatarUrl);
  const [draftAvatar, setDraftAvatar] = useState<{ name: string; url: string } | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isAccountConnected, setIsAccountConnected] = useState(() => Boolean(getStoredAccountToken()));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useGSAP(() => {
    const elements = gsap.utils.toArray<HTMLElement>(".account-settings-reveal", pageRef.current ?? undefined);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(elements, { autoAlpha: 1, y: 0 });
      return;
    }
    gsap.fromTo(elements, { autoAlpha: 0, y: 10 }, {
      autoAlpha: 1,
      duration: 0.34,
      ease: LINE_DRAW_EASE,
      stagger: 0.06,
      y: 0,
    });
  }, { scope: pageRef });

  const closeAvatarCropDialog = useCallback(() => {
    if (draftAvatarUrlRef.current) {
      URL.revokeObjectURL(draftAvatarUrlRef.current);
      draftAvatarUrlRef.current = null;
    }
    setDraftAvatar(null);
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      const next = await accountRepository.getProfile(fallback);
      setProfile(next);
      setDisplayName(next.displayName);
      setAvatarPreview(next.avatarUrl);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setStatus(null);
      setIsAccountConnected(true);
    } catch (caught) {
      setProfile(fallback);
      setDisplayName(fallback.displayName);
      setAvatarPreview(fallback.avatarUrl);
      setAvatarFile(null);
      setError(getAccountStatusMessage(caught, "认证服务未接入，账户资料暂不可用"));
      setLoadFailed(true);
      setIsAccountConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [fallback]);

  useEffect(() => {
    let active = true;
    void accountRepository.getProfile(fallback).then((next) => {
      if (!active) return;
      setProfile(next);
      setDisplayName(next.displayName);
      setAvatarPreview(next.avatarUrl);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setStatus(null);
      setIsAccountConnected(true);
      setLoadFailed(false);
    }).catch((caught) => {
      if (!active) return;
      setProfile(fallback);
      setDisplayName(fallback.displayName);
      setAvatarPreview(fallback.avatarUrl);
      setAvatarFile(null);
      setError(getAccountStatusMessage(caught, "认证服务未接入，账户资料暂不可用"));
      setLoadFailed(true);
      setIsAccountConnected(false);
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
      if (draftAvatarUrlRef.current) {
        URL.revokeObjectURL(draftAvatarUrlRef.current);
        draftAvatarUrlRef.current = null;
      }
    };
  }, [fallback]);

  const isDirty = areProfileValuesDirty(profile, { displayName }) || avatarFile !== null || removeAvatar;

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validation = validateAvatarFile(file);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    setStatus(null);
    closeAvatarCropDialog();
    const sourceUrl = URL.createObjectURL(file);
    draftAvatarUrlRef.current = sourceUrl;
    setDraftAvatar({ name: file.name, url: sourceUrl });
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!displayName.trim()) {
      setError("显示名称不能为空");
      return;
    }
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    setError(null);
    setStatus(null);
    let next = profile;
    let avatarPersisted = false;
    try {
      if (avatarFile) {
        next = await accountRepository.uploadAvatar(avatarFile, next);
        avatarPersisted = true;
      } else if (removeAvatar) {
        next = await accountRepository.removeAvatar(next);
        avatarPersisted = true;
      }
      if (displayName.trim() !== profile.displayName) {
        next = await accountRepository.updateProfile(displayName.trim(), next);
      }
      setProfile(next);
      setDisplayName(next.displayName);
      setAvatarPreview(next.avatarUrl);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setStatus("个人资料已更新");
    } catch (caught) {
      if (avatarFile && !avatarPersisted) {
        setAvatarFile(null);
        setAvatarPreview(profile.avatarUrl);
        setRemoveAvatar(false);
      } else if (avatarPersisted) {
        setProfile(next);
        setAvatarPreview(next.avatarUrl);
        setAvatarFile(null);
        setRemoveAvatar(false);
      }
      setError(getAccountStatusMessage(caught, "资料保存失败，请稍后重试"));
    } finally {
      setIsSaving(false);
    }
  };

  const removeSelectedAvatar = () => {
    closeAvatarCropDialog();
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(Boolean(profile.avatarUrl));
    setStatus(null);
  };

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setError(null);
    try {
      await accountRepository.logout();
    } catch (caught) {
      setError(getAccountStatusMessage(caught, "退出认证服务失败，已清理本地登录状态"));
    } finally {
      clearEvaluationWorkspaceSession();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("mia_rag_token");
      }
      onLogout();
    }
  };

  return (
    <section ref={pageRef} aria-labelledby="account-settings-title" className="account-settings-page">
      <header className="account-settings-header account-settings-reveal">
        <div>
          <span className="account-settings-eyebrow">ACCOUNT / IDENTITY</span>
          <h1 id="account-settings-title">设置</h1>
          <p>管理个人资料与账户访问安全。</p>
        </div>
        <div className="account-settings-header-mark" aria-hidden="true"><CircleUserRound size={26} strokeWidth={1.35} /></div>
      </header>

      {error ? <div className="account-settings-feedback is-error" role="alert"><AlertCircle size={15} />{error}{loadFailed ? <button onClick={() => void loadProfile()} type="button">重试</button> : null}</div> : null}
      {status ? <div className="account-settings-feedback is-success" role="status"><Check size={15} />{status}</div> : null}

      <form className="account-settings-profile account-settings-reveal" onSubmit={saveProfile}>
        <div className="account-settings-section-heading">
          <div><span>01</span><h2>个人资料</h2></div>
          <p>展示在平台身份信息中的资料</p>
        </div>
        <div className="account-settings-profile-body">
          <div className="account-settings-avatar-column">
            <div className="account-settings-avatar" aria-label="账户头像">
              {/* Remote avatar origins are controlled by the external auth service. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatarPreview ? <img alt={`${profile.displayName} 的头像`} src={avatarPreview} /> : <span>{profile.displayName.slice(0, 1) || "?"}</span>}
              {isLoading ? <span className="account-settings-avatar-loading"><LoaderCircle className="is-spinning" size={17} /></span> : null}
            </div>
            <div className="account-settings-avatar-actions">
              <input ref={fileInputRef} accept="image/jpeg,image/png,image/webp" className="account-settings-visually-hidden" onChange={handleAvatarChange} type="file" />
              <button className="account-settings-link-button" disabled={isSaving || !isAccountConnected} onClick={() => fileInputRef.current?.click()} type="button"><Upload size={14} />上传头像</button>
              {(avatarPreview || avatarFile) ? <button aria-label="移除头像" className="account-settings-icon-button" disabled={isSaving || !isAccountConnected} onClick={removeSelectedAvatar} title="移除头像" type="button"><Trash2 size={15} /></button> : null}
            </div>
            <small>JPG、PNG 或 WebP · 最大 2MB</small>
          </div>

          <div className="account-settings-fields">
            <label className="account-settings-field is-editable"><span>显示名称</span><input disabled={isLoading || isSaving || !isAccountConnected} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setStatus(null); setError(null); }} /></label>
            <label className="account-settings-field"><span>登录账号</span><input readOnly value={profile.username} /></label>
            <div className="account-settings-readonly-grid"><div><span>账号角色</span><strong>{roleLabel(profile.role)}</strong></div><div><span>节点类型</span><strong>{nodeTypeLabel(profile.nodeType)}</strong></div></div>
          </div>
        </div>
        <footer className="account-settings-section-footer"><span>{isLoading ? "正在读取账户资料" : !isAccountConnected ? "认证服务未接入，资料暂为只读" : isDirty ? "有未保存的资料变更" : "资料已同步"}</span><button className="account-settings-primary-button" disabled={isLoading || isSaving || !isAccountConnected || !isDirty} type="submit">{isSaving ? <LoaderCircle className="is-spinning" size={16} /> : <Check size={16} />} {isSaving ? "保存中" : "保存资料"}</button></footer>
      </form>

      <section className="account-settings-security account-settings-reveal">
        <div className="account-settings-section-heading"><div><span>02</span><h2>账户安全</h2></div><p>保护进入测评工作台的访问凭据</p></div>
        <div className="account-settings-security-row"><div className="account-settings-security-icon"><ShieldCheck size={19} /></div><div><strong>访问密码</strong><span>密码由认证服务管理，平台不会保存密码内容。</span>{profile.passwordUpdatedAt ? <small>上次更新：{formatAccountDate(profile.passwordUpdatedAt)}</small> : null}</div><button className="account-settings-secondary-button" disabled={!isAccountConnected} onClick={() => setIsPasswordDialogOpen(true)} type="button">修改密码</button></div>
      </section>

      <section className="account-settings-danger account-settings-reveal">
        <div className="account-settings-section-heading"><div><span>03</span><h2>账户操作</h2></div><p>退出后可重新登录进入工作台</p></div>
        <div className="account-settings-logout-row"><div><strong>退出当前账号</strong><span>不会删除 Agent、测评运行或报告数据。</span></div><button className="account-settings-danger-button" disabled={isLoggingOut} onClick={() => void logout()} type="button">{isLoggingOut ? <LoaderCircle className="is-spinning" size={16} /> : <LogOut size={16} />} {isLoggingOut ? "退出中" : "退出账号"}</button></div>
      </section>

      {isPasswordDialogOpen ? <AccountPasswordDialog onClose={() => setIsPasswordDialogOpen(false)} onSuccess={() => setStatus("访问密码已更新")} /> : null}
      {draftAvatar ? (
        <AccountAvatarCropDialog
          key={draftAvatar.url}
          sourceName={draftAvatar.name}
          sourceUrl={draftAvatar.url}
          onCancel={closeAvatarCropDialog}
          onConfirm={(file, previewUrl) => {
            setAvatarFile(file);
            setAvatarPreview(previewUrl);
            setRemoveAvatar(false);
            setStatus(null);
            setError(null);
            closeAvatarCropDialog();
          }}
        />
      ) : null}
    </section>
  );
}

function formatAccountDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
