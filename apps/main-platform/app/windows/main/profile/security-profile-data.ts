export type SecurityProfilePermission = "ALLOW" | "CONFIRM" | "DENY";

type AgentProfile = {
  agent_id: string;
  capability_profile: {
    data_sources: string[];
    memory_type: string;
    tool_count: number;
  };
  manifest: {
    capabilities: string[];
    data_sources: string[];
    memory: {
      max_entries?: number;
      type: string;
    };
    name: string;
    tool_permissions: Record<string, SecurityProfilePermission>;
    version: string;
  };
  security_assets: {
    dangerous_tools: string[];
    persistent_stores: string[];
    sensitive_tools: string[];
    untrusted_sources: string[];
  };
};

type AttackGraphNode = {
  labels: string[];
  metadata: {
    description: string;
    name: string;
  };
  node_id: string;
  node_type: "AGENT" | "DATA" | "MEMORY" | "SOURCE" | "TOOL";
};

type AttackGraphEdge = {
  edge_id: string;
  edge_type: string;
  metadata: {
    description: string;
  };
  source_node_id: string;
  target_node_id: string;
};

type AttackGraph = {
  edges: AttackGraphEdge[];
  nodes: AttackGraphNode[];
};

export type SecurityProfileInput = {
  agentProfile: AgentProfile;
  attackGraph: AttackGraph;
};

export type SecurityProfileNodeKind =
  | "agent"
  | "data"
  | "memory"
  | "source"
  | "tool";

export type SecurityProfileColumnId =
  | "agent-core"
  | "input-data"
  | "persistent-memory"
  | "tool-sink";

export type SecurityProfileColumn = {
  id: SecurityProfileColumnId;
  nodeIds: string[];
  subtitle: string;
  title: string;
};

export type SecurityProfileNode = {
  columnId: SecurityProfileColumnId;
  detail: string;
  evidence: string[];
  id: string;
  kind: SecurityProfileNodeKind;
  label: string;
  labels: string[];
  meta: Array<{ label: string; value: string }>;
  permission?: SecurityProfilePermission;
  subtitle: string;
};

export type SecurityProfileRoute = {
  description: string;
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
};

export type SecurityProfileViewModel = {
  agent: SecurityProfileNode;
  columns: SecurityProfileColumn[];
  data: SecurityProfileNode[];
  memory: SecurityProfileNode[];
  nodes: SecurityProfileNode[];
  permissionCounts: Record<SecurityProfilePermission, number>;
  routes: SecurityProfileRoute[];
  sources: SecurityProfileNode[];
  tools: SecurityProfileNode[];
};

const SOURCE_LABELS: Record<string, string> = {
  browser: "网页内容",
};

const TOOL_LABELS: Record<string, string> = {
  "email.read": "读取邮件",
  "email.send": "发送邮件",
};

const DATA_LABELS: Record<string, string> = {
  "email data": "邮件数据",
};

const DATA_NODE_IDS: Record<string, string> = {
  "email data": "data-email",
};

const MEMORY_LABELS: Record<string, string> = {
  persistent: "长期记忆",
};

function toNodeId(prefix: string, value: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function findAttackGraphNode(
  attackGraph: AttackGraph,
  nodeType: AttackGraphNode["node_type"],
  name: string,
) {
  return attackGraph.nodes.find(
    (node) => node.node_type === nodeType && node.metadata.name === name,
  );
}

function getPermissionCounts(toolPermissions: Record<string, SecurityProfilePermission>) {
  return Object.values(toolPermissions).reduce<Record<SecurityProfilePermission, number>>(
    (counts, permission) => {
      counts[permission] += 1;
      return counts;
    },
    { ALLOW: 0, CONFIRM: 0, DENY: 0 },
  );
}

function createSourceNode(source: string, profile: AgentProfile): SecurityProfileNode {
  const isUntrusted = profile.security_assets.untrusted_sources.includes(source);
  const permission =
    source === "browser" ? profile.manifest.tool_permissions["browser.open_page"] : undefined;

  return {
    columnId: "input-data",
    detail: isUntrusted
      ? "该来源被标记为不可信外部内容，Agent 读取后需要在后续风险分析中验证边界。"
      : "该来源来自 Agent manifest 的 data_sources，用于说明画像识别到的数据入口。",
    evidence: [
      `manifest.data_sources: ${source}`,
      isUntrusted ? `security_assets.untrusted_sources: ${source}` : "security_assets 未标记为不可信",
    ],
    id: toNodeId("source", source),
    kind: "source",
    label: SOURCE_LABELS[source] ?? source,
    labels: isUntrusted ? ["UNTRUSTED"] : ["DATA_SOURCE"],
    meta: [
      { label: "来源", value: source },
      { label: "边界", value: isUntrusted ? "不可信内容" : "已识别来源" },
    ],
    permission,
    subtitle: isUntrusted ? "UNTRUSTED SOURCE" : "DATA SOURCE",
  };
}

function createToolNode(
  graphNode: AttackGraphNode,
  profile: AgentProfile,
): SecurityProfileNode {
  const name = graphNode.metadata.name;
  const permission = profile.manifest.tool_permissions[name];
  const labels = [...new Set(graphNode.labels)];

  return {
    columnId: "tool-sink",
    detail:
      name === "email.send"
        ? "发送邮件属于外发动作，当前画像要求调用前确认。"
        : "读取邮件可访问企业邮件内容，当前画像将其作为敏感工具核对。",
    evidence: [
      `attack_graph node: ${graphNode.node_id}`,
      `manifest.tool_permissions.${name}: ${permission}`,
      `security labels: ${labels.join(" / ")}`,
    ],
    id: toNodeId("tool", name),
    kind: "tool",
    label: TOOL_LABELS[name] ?? name,
    labels,
    meta: [
      { label: "工具", value: name },
      { label: "权限", value: permission },
    ],
    permission,
    subtitle: permission === "CONFIRM" ? "CONFIRM REQUIRED" : "TOOL PERMISSION",
  };
}

function createMemoryNode(
  graphNode: AttackGraphNode,
  profile: AgentProfile,
): SecurityProfileNode {
  const memoryType = profile.manifest.memory.type;

  return {
    columnId: "persistent-memory",
    detail: "长期记忆会跨会话保留内容，画像需要明确 Agent 能读写该资产。",
    evidence: [
      `attack_graph node: ${graphNode.node_id}`,
      `manifest.memory.type: ${memoryType}`,
      `manifest.memory.max_entries: ${profile.manifest.memory.max_entries ?? "未设置"}`,
    ],
    id: toNodeId("memory", memoryType),
    kind: "memory",
    label: MEMORY_LABELS[memoryType] ?? graphNode.metadata.name,
    labels: [...new Set(graphNode.labels)],
    meta: [
      { label: "类型", value: memoryType },
      { label: "容量", value: `${profile.manifest.memory.max_entries ?? "-"} 条` },
    ],
    permission: profile.manifest.tool_permissions["memory.write"],
    subtitle: "PERSISTENT MEMORY",
  };
}

function createDataNode(graphNode: AttackGraphNode): SecurityProfileNode {
  return {
    columnId: "input-data",
    detail: "邮件内容数据被标记为敏感数据，读取工具会触达该数据边界。",
    evidence: [
      `attack_graph node: ${graphNode.node_id}`,
      `security labels: ${graphNode.labels.join(" / ")}`,
    ],
    id: DATA_NODE_IDS[graphNode.metadata.name] ?? toNodeId("data", graphNode.metadata.name),
    kind: "data",
    label: DATA_LABELS[graphNode.metadata.name] ?? graphNode.metadata.name,
    labels: [...new Set(graphNode.labels)],
    meta: [
      { label: "数据", value: graphNode.metadata.name },
      { label: "边界", value: graphNode.labels.includes("SENSITIVE") ? "敏感数据" : "数据资产" },
    ],
    subtitle: "SENSITIVE DATA",
  };
}

function mapRouteNodeId(graphNodeId: string) {
  const graphIdToProfileId: Record<string, string> = {
    n_agent_corpmate: "agent-corpmate",
    n_data_email: "data-email",
    n_memory_persistent: "memory-persistent",
    n_source_browser: "source-browser",
    n_tool_email_read: "tool-email-read",
    n_tool_email_send: "tool-email-send",
  };

  return graphIdToProfileId[graphNodeId];
}

export function createSecurityProfileViewModel({
  agentProfile,
  attackGraph,
}: SecurityProfileInput): SecurityProfileViewModel {
  const browserSource = createSourceNode("browser", agentProfile);
  const agent: SecurityProfileNode = {
    columnId: "agent-core",
    detail: "该节点代表当前被平台识别和核对的 Agent 画像主体。",
    evidence: [
      `manifest.name: ${agentProfile.manifest.name}`,
      `manifest.version: ${agentProfile.manifest.version}`,
      `capability_profile.tool_count: ${agentProfile.capability_profile.tool_count}`,
    ],
    id: "agent-corpmate",
    kind: "agent",
    label: agentProfile.manifest.name,
    labels: ["TRUSTED"],
    meta: [
      { label: "工具", value: `${agentProfile.capability_profile.tool_count} 项工具` },
      { label: "记忆", value: MEMORY_LABELS[agentProfile.capability_profile.memory_type] ?? agentProfile.capability_profile.memory_type },
    ],
    subtitle: "AGENT PROFILE",
  };
  const tools = ["email.read", "email.send"]
    .map((name) => findAttackGraphNode(attackGraph, "TOOL", name))
    .filter((node): node is AttackGraphNode => Boolean(node))
    .map((node) => createToolNode(node, agentProfile));
  const memory = attackGraph.nodes
    .filter((node) => node.node_type === "MEMORY")
    .map((node) => createMemoryNode(node, agentProfile));
  const data = attackGraph.nodes
    .filter((node) => node.node_type === "DATA")
    .map(createDataNode);
  const nodes = [browserSource, ...data, agent, ...memory, ...tools];
  const attackRoutes = attackGraph.edges
    .map((edge) => ({
      description: edge.metadata.description,
      id: edge.edge_id,
      sourceNodeId: mapRouteNodeId(edge.source_node_id),
      targetNodeId: mapRouteNodeId(edge.target_node_id),
      type: edge.edge_type,
    }))
    .filter(
      (edge): edge is SecurityProfileRoute =>
        Boolean(edge.sourceNodeId) && Boolean(edge.targetNodeId),
    );

  return {
    agent,
    columns: [
      {
        id: "input-data",
        nodeIds: ["source-browser", "data-email"],
        subtitle: "UNTRUSTED / SENSITIVE",
        title: "输入/数据边界",
      },
      {
        id: "agent-core",
        nodeIds: ["agent-corpmate"],
        subtitle: "TRUSTED EXECUTION",
        title: "Agent执行核心",
      },
      {
        id: "persistent-memory",
        nodeIds: ["memory-persistent"],
        subtitle: "PERSISTENT ASSET",
        title: "持久记忆资产",
      },
      {
        id: "tool-sink",
        nodeIds: ["tool-email-read", "tool-email-send"],
        subtitle: "ALLOW / CONFIRM",
        title: "工具/外发边界",
      },
    ],
    data,
    memory,
    nodes,
    permissionCounts: getPermissionCounts(agentProfile.manifest.tool_permissions),
    routes: attackRoutes,
    sources: [browserSource],
    tools,
  };
}
