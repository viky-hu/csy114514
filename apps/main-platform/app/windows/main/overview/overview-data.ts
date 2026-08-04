export type OverviewSeverity = "CRITICAL" | "HIGH" | "LOW" | "MEDIUM";

type AgentProfileFixture = {
  agent_id: string;
  capability_profile: {
    data_sources: string[];
    memory_type: string;
    tool_count: number;
  };
  manifest: {
    capabilities: string[];
    data_sources: string[];
    memory?: {
      type: string;
    };
    name: string;
    tool_permissions: Record<string, string>;
    version: string;
  };
  security_assets: {
    dangerous_tools: string[];
    persistent_stores: string[];
    sensitive_tools: string[];
    untrusted_sources: string[];
  };
};

type AttackGraphNodeFixture = {
  labels: string[];
  metadata: {
    description?: string;
    name?: string;
  };
  node_id: string;
  node_type: string;
};

type AttackGraphEdgeFixture = {
  edge_id: string;
  edge_type: string;
  metadata?: {
    description?: string;
  };
  source_node_id: string;
  target_node_id: string;
};

type AttackGraphFixture = {
  edges?: AttackGraphEdgeFixture[];
  nodes: AttackGraphNodeFixture[];
  risk_path_ids: string[];
};

type EvaluationEvidenceFixture = {
  description: string;
  event_id: string;
};

type EvaluationFindingFixture = {
  description: string;
  evidence: EvaluationEvidenceFixture[];
  risk_pattern_id: string;
  risk_type: string;
  severity: OverviewSeverity;
};

type EvaluationReportFixture = {
  conclusion: string;
  findings: EvaluationFindingFixture[];
  overall_score: number;
  severity: OverviewSeverity;
};

export type OverviewInput = {
  agentProfile: AgentProfileFixture;
  attackGraph: AttackGraphFixture;
  evaluationReport: EvaluationReportFixture;
};

export type OverviewAttackChainLayer = "agent" | "memory" | "source" | "tool";

export type OverviewAttackChainNode = {
  description: string;
  displayLabel: string;
  id: string;
  label: string;
  layer: OverviewAttackChainLayer;
  layerLabel: "第一层" | "第二层" | "第三层";
  nodeType: string;
  role: "agent" | "dangerous" | "memory" | "source";
  securityLabels: string[];
  stepIndex: number;
};

export type OverviewViewModel = {
  agent: {
    confirmedToolName: string;
    dangerousTools: string[];
    dataSources: string[];
    id: string;
    memoryType: string;
    name: string;
    persistentStores: string[];
    sensitiveTools: string[];
    toolCount: number;
    untrustedSources: string[];
    version: string;
  };
  attackChain: OverviewAttackChainNode[];
  process: Array<{
    english: string;
    key: string;
    label: string;
    status: "complete" | "ready";
  }>;
  r4Finding: {
    description: string;
    evidence: Array<{
      description: string;
      eventId: string;
    }>;
    riskPatternId: string;
    riskType: string;
    severity: OverviewSeverity;
  };
  risk: {
    conclusion: string;
    score: number;
    severity: OverviewSeverity;
    severityCounts: Record<OverviewSeverity, number>;
    totalFindings: number;
  };
};

const EMPTY_SEVERITY_COUNTS: Record<OverviewSeverity, number> = {
  CRITICAL: 0,
  HIGH: 0,
  LOW: 0,
  MEDIUM: 0,
};

const PROCESS_STAGES: OverviewViewModel["process"] = [
  { key: "profile", label: "画像", english: "能力边界", status: "complete" },
  { key: "anatomy", label: "图谱", english: "风险路径", status: "complete" },
  { key: "run", label: "测评", english: "执行留痕", status: "complete" },
  { key: "report", label: "报告", english: "证据归档", status: "ready" },
];

const R4_CHAIN_STEPS = [
  {
    displayLabel: "网页输入",
    fallbackLabel: "browser.open_page",
    layer: "source",
    layerLabel: "第一层",
    role: "source",
  },
  {
    displayLabel: "Agent解析",
    fallbackLabel: "Agent",
    layer: "agent",
    layerLabel: "第二层",
    role: "agent",
  },
  {
    displayLabel: "持久记忆",
    fallbackLabel: "memory",
    layer: "memory",
    layerLabel: "第三层",
    role: "memory",
  },
  {
    displayLabel: "Agent唤起",
    fallbackLabel: "Agent",
    layer: "agent",
    layerLabel: "第二层",
    role: "agent",
  },
  {
    displayLabel: "邮件发送",
    fallbackLabel: "email.send",
    layer: "tool",
    layerLabel: "第三层",
    role: "dangerous",
  },
] as const satisfies Array<{
  displayLabel: string;
  fallbackLabel: string;
  layer: OverviewAttackChainLayer;
  layerLabel: OverviewAttackChainNode["layerLabel"];
  role: OverviewAttackChainNode["role"];
}>;

function countSeverities(findings: EvaluationFindingFixture[]) {
  return findings.reduce<Record<OverviewSeverity, number>>(
    (counts, finding) => ({
      ...counts,
      [finding.severity]: counts[finding.severity] + 1,
    }),
    { ...EMPTY_SEVERITY_COUNTS },
  );
}

function getNodeBy(
  nodes: AttackGraphNodeFixture[],
  predicate: (node: AttackGraphNodeFixture) => boolean,
) {
  return nodes.find(predicate);
}

function hasEdge(
  edges: AttackGraphEdgeFixture[],
  sourceNode: AttackGraphNodeFixture | undefined,
  targetNode: AttackGraphNodeFixture | undefined,
) {
  if (!sourceNode || !targetNode) {
    return false;
  }

  return edges.some(
    (edge) =>
      edge.source_node_id === sourceNode.node_id &&
      edge.target_node_id === targetNode.node_id,
  );
}

function getDangerousNode(
  nodes: AttackGraphNodeFixture[],
  edges: AttackGraphEdgeFixture[],
  agentNode: AttackGraphNodeFixture | undefined,
  dangerousToolNames: string[],
) {
  const dangerousCandidates = nodes.filter(
    (node) =>
      node.labels.includes("DANGEROUS") ||
      dangerousToolNames.includes(node.metadata.name ?? ""),
  );

  return (
    dangerousCandidates.find((node) => hasEdge(edges, agentNode, node)) ??
    dangerousCandidates[0]
  );
}

function createAttackChainNode(
  node: AttackGraphNodeFixture | undefined,
  stepIndex: number,
  fallbackLabel: string,
): OverviewAttackChainNode {
  const step = R4_CHAIN_STEPS[stepIndex];

  return {
    description: node?.metadata.description ?? "",
    displayLabel: step.displayLabel,
    id: node?.node_id ?? fallbackLabel,
    label: node?.metadata.name ?? fallbackLabel,
    layer: step.layer,
    layerLabel: step.layerLabel,
    nodeType: node?.node_type ?? step.layer.toUpperCase(),
    role: step.role,
    securityLabels: node?.labels ?? [],
    stepIndex,
  };
}

export function createOverviewViewModel({
  agentProfile,
  attackGraph,
  evaluationReport,
}: OverviewInput): OverviewViewModel {
  const edges = attackGraph.edges ?? [];
  const sourceNode = getNodeBy(
    attackGraph.nodes,
    (node) =>
      node.node_type === "SOURCE" || node.labels.includes("UNTRUSTED"),
  );
  const agentNode = getNodeBy(
    attackGraph.nodes,
    (node) => node.node_type === "AGENT",
  );
  const memoryNode = getNodeBy(
    attackGraph.nodes,
    (node) =>
      node.node_type === "MEMORY" || node.labels.includes("PERSISTENT"),
  );
  const confirmedToolName =
    Object.entries(agentProfile.manifest.tool_permissions).find(
      ([, permission]) => permission === "CONFIRM",
    )?.[0] ?? agentProfile.security_assets.dangerous_tools[0] ?? "";
  const dangerousNode = getDangerousNode(
    attackGraph.nodes,
    edges,
    agentNode,
    agentProfile.security_assets.dangerous_tools,
  );
  const r4Finding =
    evaluationReport.findings.find(
      (finding) => finding.risk_pattern_id === "R4",
    ) ?? evaluationReport.findings[0];
  const memoryLabel =
    agentProfile.security_assets.persistent_stores[0] ??
    memoryNode?.metadata.name ??
    "memory";

  if (!r4Finding) {
    throw new Error("Overview requires at least one evaluation finding.");
  }

  const sourceStep = createAttackChainNode(
    sourceNode,
    0,
    R4_CHAIN_STEPS[0].fallbackLabel,
  );
  const agentParseStep = createAttackChainNode(
    agentNode,
    1,
    agentProfile.manifest.name,
  );
  const memoryStep = {
    ...createAttackChainNode(memoryNode, 2, R4_CHAIN_STEPS[2].fallbackLabel),
    label: memoryLabel,
  };
  const agentRecallStep = createAttackChainNode(
    agentNode,
    3,
    agentProfile.manifest.name,
  );
  const toolStep = createAttackChainNode(
    dangerousNode,
    4,
    confirmedToolName || R4_CHAIN_STEPS[4].fallbackLabel,
  );

  return {
    agent: {
      confirmedToolName,
      dangerousTools: agentProfile.security_assets.dangerous_tools,
      dataSources: agentProfile.capability_profile.data_sources,
      id: agentProfile.agent_id,
      memoryType:
        agentProfile.capability_profile.memory_type ??
        agentProfile.manifest.memory?.type ??
        "unknown",
      name: agentProfile.manifest.name,
      persistentStores: agentProfile.security_assets.persistent_stores,
      sensitiveTools: agentProfile.security_assets.sensitive_tools,
      toolCount: agentProfile.capability_profile.tool_count,
      untrustedSources: agentProfile.security_assets.untrusted_sources,
      version: agentProfile.manifest.version,
    },
    attackChain: [
      sourceStep,
      agentParseStep,
      memoryStep,
      agentRecallStep,
      toolStep,
    ],
    process: PROCESS_STAGES,
    r4Finding: {
      description: r4Finding.description,
      evidence: r4Finding.evidence.map((item) => ({
        description: item.description,
        eventId: item.event_id,
      })),
      riskPatternId: r4Finding.risk_pattern_id,
      riskType: r4Finding.risk_type,
      severity: r4Finding.severity,
    },
    risk: {
      conclusion: evaluationReport.conclusion,
      score: evaluationReport.overall_score,
      severity: evaluationReport.severity,
      severityCounts: countSeverities(evaluationReport.findings),
      totalFindings: evaluationReport.findings.length,
    },
  };
}
