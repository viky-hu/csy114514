"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { AgentConnectDraft } from "../../login/AgentConnectDraft";
import {
  CORPMATE_AGENT_DRAFT,
  buildAgentManifest,
  createAgentDraftFromProfile,
  type AgentProfilePayload,
  type AgentDraftState,
} from "../../shared/agent-config";

type AgentInterfaceWorkspaceProps = {
  activeAgentId: string;
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
  onAgentSaved,
}: AgentInterfaceWorkspaceProps) {
  const [draft, setDraft] = useState<AgentDraftState>(CORPMATE_AGENT_DRAFT);
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const manifest = useMemo(() => buildAgentManifest(draft), [draft]);
  const canSave = Boolean(manifest.agent_id.trim() && manifest.name.trim());

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
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      });
      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Agent 保存失败"));
      }

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
        {status === "loading" ? "正在读取当前 Agent 配置" : null}
        {status === "saving" ? "正在保存并准备重启主窗口" : null}
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
    </section>
  );
}
