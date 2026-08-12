"use client";

import { useMemo, type ReactNode } from "react";
import { Braces, CheckCircle2, Github, Package, RefreshCw, Server } from "lucide-react";
import {
  CAPABILITY_DEFINITIONS,
  CORPMATE_AGENT_DRAFT,
  DATA_SOURCE_DEFINITIONS,
  HTTP_METHODS,
  TOOL_DEFINITIONS,
  buildAgentManifest,
  getAgentDraftRiskAssets,
  parseAgentHeaders,
  type AgentDraftState,
  type HttpMethod,
  type MemoryType,
  type Permission,
} from "../shared/agent-config";

interface SummaryItem {
  label: string;
  value: string;
}

type AgentConnectDraftProps = {
  draft: AgentDraftState;
  footer?: ReactNode;
  onDraftChange: (draft: AgentDraftState) => void;
};

function formatList(items: string[]) {
  return items.length > 0 ? items.join(" / ") : "无";
}

export function AgentConnectDraft({
  draft,
  footer,
  onDraftChange,
}: AgentConnectDraftProps) {
  const selectedCapabilities = CAPABILITY_DEFINITIONS.filter(
    (capability) => draft.enabledCapabilities[capability.name],
  );
  const selectedDataSources = DATA_SOURCE_DEFINITIONS.filter(
    (source) => draft.enabledDataSources[source],
  );
  const selectedPermissionEntries = TOOL_DEFINITIONS.filter(
    (capability) => draft.enabledCapabilities[capability.name],
  ).map((capability): [string, Permission] => [
    capability.name,
    draft.toolPermissions[capability.name] ?? "ALLOW",
  ]);
  const parsedHeaderResult = useMemo(
    () => parseAgentHeaders(draft.headers),
    [draft.headers],
  );
  const manifestPreview = buildAgentManifest(draft);
  const adapterPreview = {
    endpoint: draft.endpoint.trim(),
    headers:
      typeof parsedHeaderResult === "string"
        ? draft.headers
        : parsedHeaderResult,
    method: draft.method,
    request_template: draft.requestTemplate,
    response_path: draft.responsePath.trim(),
  };
  const securityAssetDraft = getAgentDraftRiskAssets(draft);
  const headersError = typeof parsedHeaderResult === "string" ? parsedHeaderResult : "";
  const selectedToolCount = selectedCapabilities.filter(
    (capability) => capability.defaultPermission,
  ).length;
  const confirmPermissionCount = selectedPermissionEntries.filter(
    ([, permission]) => permission === "CONFIRM",
  ).length;
  const summaryItems: SummaryItem[] = [
    { label: "工具数", value: String(selectedToolCount) },
    { label: "数据源", value: String(selectedDataSources.length) },
    { label: "记忆", value: draft.memoryType },
    { label: "确认门", value: String(confirmPermissionCount) },
  ];
  const riskItems: SummaryItem[] = [
    { label: "敏感工具", value: formatList(securityAssetDraft.sensitive_tools) },
    { label: "危险工具", value: formatList(securityAssetDraft.dangerous_tools) },
    { label: "持久存储", value: formatList(securityAssetDraft.persistent_stores) },
    { label: "不可信源", value: formatList(securityAssetDraft.untrusted_sources) },
  ];
  const validationItems: SummaryItem[] = [
    {
      label: "Manifest",
      value: draft.agentId.trim() && draft.agentName.trim() ? "可提交" : "缺少标识",
    },
    {
      label: "Headers",
      value: headersError || "JSON 可解析",
    },
    {
      label: "Adapter",
      value: draft.endpoint.trim() ? "本地草稿" : "缺少 Endpoint",
    },
  ];

  const patchDraft = (patch: Partial<AgentDraftState>) => {
    onDraftChange({ ...draft, ...patch });
  };

  const toggleCapability = (name: string) => {
    patchDraft({
      enabledCapabilities: {
        ...draft.enabledCapabilities,
        [name]: !draft.enabledCapabilities[name],
      },
    });
  };

  const toggleDataSource = (name: string) => {
    patchDraft({
      enabledDataSources: {
        ...draft.enabledDataSources,
        [name]: !draft.enabledDataSources[name],
      },
    });
  };

  const updatePermission = (name: string, permission: Permission) => {
    patchDraft({
      toolPermissions: {
        ...draft.toolPermissions,
        [name]: permission,
      },
    });
  };

  return (
    <section className="login-agent-draft" aria-label="Agent 接入草稿">
      <form className="login-agent-draft-form" onSubmit={(event) => event.preventDefault()}>
        <div className="login-agent-draft-toolbar">
          <span>Agent 接入</span>
          <button
            type="button"
            className="login-agent-text-action"
            onClick={() => onDraftChange(CORPMATE_AGENT_DRAFT)}
            aria-label="恢复 CorpMate 预设"
          >
            <RefreshCw aria-hidden="true" />
            <span>CorpMate 预设</span>
          </button>
        </div>

        <div className="login-agent-channel-row" aria-label="接入来源">
          <button type="button" className="login-agent-channel is-active">
            <Server aria-hidden="true" />
            <span>API 主线</span>
          </button>
          <button
            type="button"
            className="login-agent-channel"
            aria-disabled="true"
            title="Beta 入口展示"
          >
            <Package aria-hidden="true" />
            <span>Docker Beta</span>
          </button>
          <button
            type="button"
            className="login-agent-channel"
            aria-disabled="true"
            title="Beta 入口展示"
          >
            <Github aria-hidden="true" />
            <span>GitHub Beta</span>
          </button>
        </div>

        <div className="login-agent-field-grid is-three">
          <label className="login-agent-field">
            <span>Agent ID</span>
            <input
              value={draft.agentId}
              onChange={(event) => patchDraft({ agentId: event.target.value })}
            />
          </label>
          <label className="login-agent-field">
            <span>名称</span>
            <input
              value={draft.agentName}
              onChange={(event) => patchDraft({ agentName: event.target.value })}
            />
          </label>
          <label className="login-agent-field">
            <span>版本</span>
            <input
              value={draft.version}
              onChange={(event) => patchDraft({ version: event.target.value })}
            />
          </label>
        </div>

        <div className="login-agent-field-grid is-api">
          <label className="login-agent-field">
            <span>Endpoint</span>
            <input
              value={draft.endpoint}
              onChange={(event) => patchDraft({ endpoint: event.target.value })}
            />
          </label>
          <label className="login-agent-field">
            <span>Method</span>
            <select
              value={draft.method}
              onChange={(event) =>
                patchDraft({ method: event.target.value as HttpMethod })
              }
            >
              {HTTP_METHODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="login-agent-field-grid is-two">
          <label className="login-agent-field">
            <span>Headers</span>
            <textarea
              value={draft.headers}
              onChange={(event) => patchDraft({ headers: event.target.value })}
              aria-invalid={headersError ? "true" : "false"}
              spellCheck={false}
            />
          </label>
          <label className="login-agent-field">
            <span>Request Template</span>
            <textarea
              value={draft.requestTemplate}
              onChange={(event) => patchDraft({ requestTemplate: event.target.value })}
              spellCheck={false}
            />
          </label>
        </div>

        <div className="login-agent-field-grid is-two">
          <label className="login-agent-field">
            <span>Response Path</span>
            <input
              value={draft.responsePath}
              onChange={(event) => patchDraft({ responsePath: event.target.value })}
            />
          </label>
          <label className="login-agent-field">
            <span>Memory</span>
            <span className="login-agent-inline-controls">
              <select
                value={draft.memoryType}
                onChange={(event) =>
                  patchDraft({ memoryType: event.target.value as MemoryType })
                }
              >
                <option value="none">none</option>
                <option value="ephemeral">ephemeral</option>
                <option value="persistent">persistent</option>
              </select>
              <input
                type="number"
                min="1"
                value={draft.memoryMaxEntries}
                disabled={draft.memoryType === "none"}
                onChange={(event) =>
                  patchDraft({ memoryMaxEntries: event.target.value })
                }
              />
            </span>
          </label>
        </div>

        <fieldset className="login-agent-option-group">
          <legend>能力声明</legend>
          <div className="login-agent-chip-grid">
            {CAPABILITY_DEFINITIONS.map((capability) => (
              <label key={capability.name} className="login-agent-chip">
                <input
                  type="checkbox"
                  checked={draft.enabledCapabilities[capability.name] ?? false}
                  onChange={() => toggleCapability(capability.name)}
                />
                <span>{capability.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="login-agent-bottom-grid">
          <fieldset className="login-agent-option-group">
            <legend>数据源</legend>
            <div className="login-agent-source-row">
              {DATA_SOURCE_DEFINITIONS.map((source) => (
                <label key={source} className="login-agent-chip">
                  <input
                    type="checkbox"
                    checked={draft.enabledDataSources[source] ?? false}
                    onChange={() => toggleDataSource(source)}
                  />
                  <span>{source}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="login-agent-option-group">
            <legend>工具权限</legend>
            <div className="login-agent-permission-grid">
              {TOOL_DEFINITIONS.map((tool) => (
                <label key={tool.name} className="login-agent-permission-row">
                  <span>{tool.name}</span>
                  <select
                    value={draft.toolPermissions[tool.name] ?? "ALLOW"}
                    disabled={!draft.enabledCapabilities[tool.name]}
                    onChange={(event) =>
                      updatePermission(tool.name, event.target.value as Permission)
                    }
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="CONFIRM">CONFIRM</option>
                    <option value="DENY">DENY</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {headersError ? <p className="login-agent-field-error">{headersError}</p> : null}
        {footer}
      </form>

      <div className="login-agent-draft-divider" aria-hidden="true" />

      <aside className="login-agent-draft-preview" aria-label="Agent 画像预检">
        <div className="login-agent-draft-toolbar">
          <span>画像预检</span>
          <span>Manifest 真提交 / Adapter 本地草稿</span>
        </div>

        <div className="login-agent-profile-grid">
          {summaryItems.map((item) => (
            <div key={item.label} className="login-agent-profile-stat">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="login-agent-risk-list">
          {riskItems.map((item) => (
            <div key={item.label} className="login-agent-risk-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="login-agent-check-list">
          {validationItems.map((item) => (
            <div key={item.label} className="login-agent-check-row">
              <CheckCircle2 aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="login-agent-adapter-card">
          <span>API 接入</span>
          <strong>
            {draft.method} {draft.endpoint.trim() || "未填写 Endpoint"}
          </strong>
          <span>Response Path</span>
          <strong>{draft.responsePath.trim() || "未填写"}</strong>
        </div>

        <details className="login-agent-json-details">
          <summary>
            <Braces aria-hidden="true" />
            <span>查看 AgentManifest JSON</span>
          </summary>
          <pre>{JSON.stringify(manifestPreview, null, 2)}</pre>
        </details>

        <details className="login-agent-json-details">
          <summary>
            <Braces aria-hidden="true" />
            <span>查看 API Adapter 草稿</span>
          </summary>
          <pre>{JSON.stringify(adapterPreview, null, 2)}</pre>
        </details>
      </aside>
    </section>
  );
}
