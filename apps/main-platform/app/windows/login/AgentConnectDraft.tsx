"use client";

import { useMemo, useState } from "react";
import { Braces, CheckCircle2, Github, Package, RefreshCw, Server } from "lucide-react";

type HttpMethod = "POST" | "GET" | "PUT" | "PATCH";
type Permission = "ALLOW" | "CONFIRM" | "DENY";
type MemoryType = "none" | "ephemeral" | "persistent";

interface CapabilityDefinition {
  name: string;
  nodeType?: "SOURCE" | "TOOL" | "MEMORY";
  labels?: Array<"UNTRUSTED" | "SENSITIVE" | "DANGEROUS" | "PERSISTENT">;
  defaultPermission?: Permission;
}

interface SummaryItem {
  label: string;
  value: string;
}

const HTTP_METHODS: HttpMethod[] = ["POST", "GET", "PUT", "PATCH"];

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  { name: "chat" },
  {
    name: "browser.open_page",
    nodeType: "SOURCE",
    labels: ["UNTRUSTED"],
    defaultPermission: "ALLOW",
  },
  { name: "email.list", nodeType: "TOOL", defaultPermission: "ALLOW" },
  {
    name: "email.read",
    nodeType: "TOOL",
    labels: ["SENSITIVE"],
    defaultPermission: "ALLOW",
  },
  {
    name: "email.send",
    nodeType: "TOOL",
    labels: ["DANGEROUS"],
    defaultPermission: "CONFIRM",
  },
  {
    name: "memory.read",
    nodeType: "MEMORY",
    labels: ["PERSISTENT"],
    defaultPermission: "ALLOW",
  },
  {
    name: "memory.write",
    nodeType: "MEMORY",
    labels: ["PERSISTENT"],
    defaultPermission: "ALLOW",
  },
];

const DATA_SOURCE_DEFINITIONS = ["browser", "email", "memory"] as const;
const TOOL_DEFINITIONS = CAPABILITY_DEFINITIONS.filter(
  (capability) => capability.defaultPermission,
);

const DEFAULT_HEADERS = '{\n  "Content-Type": "application/json"\n}';
const DEFAULT_REQUEST_TEMPLATE = '{\n  "message": "{{input}}"\n}';

const createEnabledRecord = (names: readonly string[]) =>
  Object.fromEntries(names.map((name) => [name, true])) as Record<string, boolean>;

const createPermissionRecord = () =>
  Object.fromEntries(
    TOOL_DEFINITIONS.map((capability) => [
      capability.name,
      capability.defaultPermission ?? "ALLOW",
    ]),
  ) as Record<string, Permission>;

function parseHeaders(value: string) {
  if (!value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return "Headers 必须是 JSON 对象";
    }

    return parsed as Record<string, unknown>;
  } catch {
    return "Headers JSON 无法解析";
  }
}

function formatList(items: string[]) {
  return items.length > 0 ? items.join(" / ") : "无";
}

export function AgentConnectDraft() {
  const [agentId, setAgentId] = useState("corpmate-v0");
  const [agentName, setAgentName] = useState("CorpMate v0");
  const [version, setVersion] = useState("0.1.0");
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:8000/chat");
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [headers, setHeaders] = useState(DEFAULT_HEADERS);
  const [requestTemplate, setRequestTemplate] = useState(DEFAULT_REQUEST_TEMPLATE);
  const [responsePath, setResponsePath] = useState("$.content");
  const [enabledCapabilities, setEnabledCapabilities] = useState(() =>
    createEnabledRecord(CAPABILITY_DEFINITIONS.map((capability) => capability.name)),
  );
  const [enabledDataSources, setEnabledDataSources] = useState(() =>
    createEnabledRecord(DATA_SOURCE_DEFINITIONS),
  );
  const [memoryType, setMemoryType] = useState<MemoryType>("persistent");
  const [memoryMaxEntries, setMemoryMaxEntries] = useState("100");
  const [toolPermissions, setToolPermissions] = useState(createPermissionRecord);

  const selectedCapabilities = CAPABILITY_DEFINITIONS.filter(
    (capability) => enabledCapabilities[capability.name],
  );
  const selectedCapabilityNames = selectedCapabilities.map((capability) => capability.name);
  const selectedDataSources = DATA_SOURCE_DEFINITIONS.filter(
    (source) => enabledDataSources[source],
  );
  const selectedPermissionEntries = TOOL_DEFINITIONS.filter(
    (capability) => enabledCapabilities[capability.name],
  ).map((capability): [string, Permission] => [
    capability.name,
    toolPermissions[capability.name] ?? "ALLOW",
  ]);
  const parsedHeaderResult = useMemo(() => parseHeaders(headers), [headers]);
  const memoryLimit = Number.parseInt(memoryMaxEntries, 10);
  const manifestPreview = {
    agent_id: agentId.trim() || "agent-draft",
    name: agentName.trim() || "未命名 Agent",
    version: version.trim() || "0.1.0",
    capabilities: selectedCapabilityNames,
    data_sources: selectedDataSources,
    memory:
      memoryType === "none"
        ? {}
        : {
            type: memoryType,
            ...(Number.isFinite(memoryLimit) && memoryLimit > 0
              ? { max_entries: memoryLimit }
              : {}),
          },
    tool_permissions: Object.fromEntries(selectedPermissionEntries),
  };
  const adapterPreview = {
    endpoint: endpoint.trim(),
    method,
    headers: typeof parsedHeaderResult === "string" ? headers : parsedHeaderResult,
    request_template: requestTemplate,
    response_path: responsePath.trim(),
  };
  const securityAssetDraft = {
    sensitive_tools: selectedCapabilities
      .filter((capability) => capability.labels?.includes("SENSITIVE"))
      .map((capability) => capability.name),
    dangerous_tools: selectedCapabilities
      .filter((capability) => capability.labels?.includes("DANGEROUS"))
      .map((capability) => capability.name),
    persistent_stores:
      memoryType === "persistent" && selectedDataSources.includes("memory") ? ["memory"] : [],
    untrusted_sources: selectedDataSources.includes("browser") ? ["browser"] : [],
  };
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
    { label: "记忆", value: memoryType },
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
      value: agentId.trim() && agentName.trim() ? "可生成" : "缺少标识",
    },
    {
      label: "Headers",
      value: headersError || "JSON 可解析",
    },
    {
      label: "Adapter",
      value: endpoint.trim() ? "API 草稿就绪" : "缺少 Endpoint",
    },
  ];

  const toggleCapability = (name: string) => {
    setEnabledCapabilities((current) => ({
      ...current,
      [name]: !current[name],
    }));
  };

  const toggleDataSource = (name: string) => {
    setEnabledDataSources((current) => ({
      ...current,
      [name]: !current[name],
    }));
  };

  const updatePermission = (name: string, permission: Permission) => {
    setToolPermissions((current) => ({
      ...current,
      [name]: permission,
    }));
  };

  const resetCorpMatePreset = () => {
    setAgentId("corpmate-v0");
    setAgentName("CorpMate v0");
    setVersion("0.1.0");
    setEndpoint("http://127.0.0.1:8000/chat");
    setMethod("POST");
    setHeaders(DEFAULT_HEADERS);
    setRequestTemplate(DEFAULT_REQUEST_TEMPLATE);
    setResponsePath("$.content");
    setEnabledCapabilities(
      createEnabledRecord(CAPABILITY_DEFINITIONS.map((capability) => capability.name)),
    );
    setEnabledDataSources(createEnabledRecord(DATA_SOURCE_DEFINITIONS));
    setMemoryType("persistent");
    setMemoryMaxEntries("100");
    setToolPermissions(createPermissionRecord());
  };

  return (
    <section className="login-agent-draft" aria-label="Agent 接入草稿">
      <form className="login-agent-draft-form" onSubmit={(event) => event.preventDefault()}>
        <div className="login-agent-draft-toolbar">
          <span>Agent 接入</span>
          <button
            type="button"
            className="login-agent-text-action"
            onClick={resetCorpMatePreset}
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
            <input value={agentId} onChange={(event) => setAgentId(event.target.value)} />
          </label>
          <label className="login-agent-field">
            <span>名称</span>
            <input value={agentName} onChange={(event) => setAgentName(event.target.value)} />
          </label>
          <label className="login-agent-field">
            <span>版本</span>
            <input value={version} onChange={(event) => setVersion(event.target.value)} />
          </label>
        </div>

        <div className="login-agent-field-grid is-api">
          <label className="login-agent-field">
            <span>Endpoint</span>
            <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
          </label>
          <label className="login-agent-field">
            <span>Method</span>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
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
              value={headers}
              onChange={(event) => setHeaders(event.target.value)}
              aria-invalid={headersError ? "true" : "false"}
              spellCheck={false}
            />
          </label>
          <label className="login-agent-field">
            <span>Request Template</span>
            <textarea
              value={requestTemplate}
              onChange={(event) => setRequestTemplate(event.target.value)}
              spellCheck={false}
            />
          </label>
        </div>

        <div className="login-agent-field-grid is-two">
          <label className="login-agent-field">
            <span>Response Path</span>
            <input value={responsePath} onChange={(event) => setResponsePath(event.target.value)} />
          </label>
          <label className="login-agent-field">
            <span>Memory</span>
            <span className="login-agent-inline-controls">
              <select
                value={memoryType}
                onChange={(event) => setMemoryType(event.target.value as MemoryType)}
              >
                <option value="none">none</option>
                <option value="ephemeral">ephemeral</option>
                <option value="persistent">persistent</option>
              </select>
              <input
                type="number"
                min="1"
                value={memoryMaxEntries}
                disabled={memoryType === "none"}
                onChange={(event) => setMemoryMaxEntries(event.target.value)}
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
                  checked={enabledCapabilities[capability.name]}
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
                    checked={enabledDataSources[source]}
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
                    value={toolPermissions[tool.name] ?? "ALLOW"}
                    disabled={!enabledCapabilities[tool.name]}
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
      </form>

      <div className="login-agent-draft-divider" aria-hidden="true" />

      <aside className="login-agent-draft-preview" aria-label="Agent 画像预检">
        <div className="login-agent-draft-toolbar">
          <span>画像预检</span>
          <span>本地草稿</span>
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
            {method} {endpoint.trim() || "未填写 Endpoint"}
          </strong>
          <span>Response Path</span>
          <strong>{responsePath.trim() || "未填写"}</strong>
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
