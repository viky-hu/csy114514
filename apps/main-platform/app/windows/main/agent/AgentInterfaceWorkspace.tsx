"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, RotateCcw, Save } from "lucide-react";
import { saveAgentManifest } from "./agent-manifest-repository";
import { AgentConnectDraft } from "../../login/AgentConnectDraft";
import { useLoadingTip } from "../../shared/loading-tips";
import {
  CORPMATE_AGENT_DRAFT,
  buildAgentManifest,
  createAgentDraftFromProfile,
  type AgentManifest,
  type AgentProfilePayload,
  type AgentDraftState,
} from "../../shared/agent-config";
import { MIA_RAG_TOKEN_KEY } from "../../../lib/client/auth-adapter";

type AgentInterfaceWorkspaceProps = {
  activeAgentId: string;
  onDraftSnapshotChange?: (manifest: AgentManifest | null) => void;
  onAgentSaved: (agentId: string) => void;
};

type WorkspaceStatus = "idle" | "loading" | "saving" | "saved";

function getErrorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const error = (value as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}

function isAgentProfilePayload(value: unknown): value is AgentProfilePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as { agent_id?: unknown; manifest?: unknown };
  if (typeof profile.agent_id !== "string") {
    return false;
  }
  const manifest = profile.manifest as
    | { agent_id?: unknown; name?: unknown; version?: unknown }
    | undefined;
  return (
    !!manifest &&
    typeof manifest.agent_id === "string" &&
    typeof manifest.name === "string" &&
    typeof manifest.version === "string"
  );
}

export function AgentInterfaceWorkspace({
  activeAgentId,
  onDraftSnapshotChange,
  onAgentSaved,
}: AgentInterfaceWorkspaceProps) {
  const [draft, setDraft] = useState<AgentDraftState>(CORPMATE_AGENT_DRAFT);
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statusTip = useLoadingTip("boot", {
    active: status === "loading" || status === "saving",
  });

  const manifest = useMemo(() => buildAgentManifest(draft), [draft]);
  const canSave = Boolean(draft.agentId.trim() && draft.agentName.trim());

  useEffect(() => {
    onDraftSnapshotChange?.(canSave ? manifest : null);
    return () => onDraftSnapshotChange?.(null);
  }, [canSave, manifest, onDraftSnapshotChange]);

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(activeAgentId)}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(getErrorMessage(body, "当前 Agent 暂不可用，已保留默认配置"));
        }

        if (!isAgentProfilePayload(body)) {
          throw new Error("当前 Agent 返回格式不可识别，已保留默认配置");
        }

        if (!controller.signal.aborted) {
          setDraft(createAgentDraftFromProfile(body));
          setStatus("idle");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setDraft((current) =>
          current.agentId === activeAgentId ? current : { ...CORPMATE_AGENT_DRAFT, agentId: activeAgentId },
        );
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "当前 Agent 暂不可用，已保留默认配置",
        );
        setStatus("idle");
      }
    };

    void loadProfile();

    return () => controller.abort();
  }, [activeAgentId]);

  const handleSave = async () => {
    if (!canSave || status === "saving") {
      return;
    }

    setStatus("saving");
    setErrorMessage(null);

    try {
      await saveAgentManifest(manifest);

      setStatus("saved");
      onAgentSaved(manifest.agent_id);
    } catch (error) {
      setStatus("idle");
      setErrorMessage(error instanceof Error ? error.message : "Agent 保存失败");
    }
  };

  const footer = (
    <div className="agent-interface-footer">
      <div className="agent-interface-status" aria-live="polite">
        {status === "loading" || status === "saving" ? statusTip : null}
        {status === "saved" ? "Agent 已保存" : null}
        {errorMessage ? <span role="alert">{errorMessage}</span> : null}
      </div>
      <div className="agent-interface-actions">
        <button
          type="button"
          className="login-agent-text-action"
          onClick={() => {
            setDraft(CORPMATE_AGENT_DRAFT);
            setErrorMessage(null);
          }}
        >
          <RotateCcw aria-hidden="true" />
          <span>恢复预设</span>
        </button>
        <button
          type="button"
          className="agent-interface-save-button"
          disabled={!canSave || status === "loading" || status === "saving"}
          onClick={() => void handleSave()}
        >
          <Save aria-hidden="true" />
          <span>{status === "saving" ? "保存中" : "保存并重启"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <section
      className="agent-interface-page"
      aria-label={`初始接口配置，当前 Agent ${activeAgentId}`}
    >
      <AgentConnectDraft draft={draft} footer={footer} onDraftChange={setDraft} />
      <AdapterConnectionPanel agentId={manifest.agent_id} />
    </section>
  );
}

function AdapterConnectionPanel({ agentId }: { agentId: string }) {
  const [endpoint, setEndpoint] = useState("");
  const [authReference, setAuthReference] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "ready">("idle");
  const [message, setMessage] = useState("尚未配置专用红队测试连接。");

  const headers = () => {
    const next = new Headers({ "Content-Type": "application/json" });
    const token = typeof window === "undefined" ? null : window.localStorage.getItem(MIA_RAG_TOKEN_KEY);
    if (token) next.set("Authorization", `Bearer ${token}`);
    return next;
  };

  const verify = async () => {
    if (!agentId.trim() || !endpoint.trim() || status === "verifying") return;
    setStatus("verifying");
    try {
      const response = await fetch("/api/redteam/connections", {
        body: JSON.stringify({ agent_id: agentId, endpoint: endpoint.trim(), auth_reference: authReference.trim() || null }),
        headers: headers(),
        method: "POST",
      });
      const body = await response.json() as { adapter_metadata?: { protocol_version?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "红队连接验证失败");
      setStatus("ready");
      setMessage(`已验证 Adapter ${body.adapter_metadata?.protocol_version ?? "v1"}；仅可用于测试环境。`);
    } catch (error) {
      setStatus("idle");
      setMessage(error instanceof Error ? error.message : "红队连接验证失败");
    }
  };

  return <aside className="agent-redteam-connection" aria-label="红队 HTTP Adapter 连接">
    <div><span>RED TEAM ADAPTER</span><h2><Link2 size={16} />专用演练连接</h2><p>连接配置与 AgentManifest 分离保存；认证值只接受服务端密钥引用，页面不保存或回显密钥。</p></div>
    <label>HTTPS 测试端点<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://adapter.example.com" inputMode="url" /></label>
    <label>认证引用（可选）<input value={authReference} onChange={(event) => setAuthReference(event.target.value)} placeholder="vault://team/agent-redteam" /></label>
    <button type="button" disabled={!endpoint.trim() || status === "verifying"} onClick={() => void verify()}>{status === "verifying" ? "验证中…" : "验证并保存连接"}</button>
    <small data-ready={status === "ready"}>{message}</small>
  </aside>;
}
