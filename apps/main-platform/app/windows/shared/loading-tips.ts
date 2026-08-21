import { useEffect, useRef, useState } from "react";

export type LoadingTipPhase =
  | "boot"
  | "error"
  | "idle"
  | "judging"
  | "preflight"
  | "reporting"
  | "running";

export type LoadingTipCategory = "knowledge" | "stage_r4" | "status" | "tip";

export type LoadingTipMode = "live" | "timeline";

export interface LoadingTip {
  category: LoadingTipCategory;
  id: string;
  phase: LoadingTipPhase;
  text: string;
}

type EvaluationLoadingTipState = {
  activeStage?: string | null;
  hasReport?: boolean;
  isBootstrapping?: boolean;
  isLoadingReport?: boolean;
  isLoadingTestCases?: boolean;
  latestEventType?: string;
  reportError?: string | null;
  runStatus?: string;
  testCaseError?: string | null;
  workspaceError?: string | null;
};

const LOADING_TIPS: LoadingTip[] = [
  { id: "boot-01", phase: "boot", category: "status", text: "正在校准安全评测引擎…" },
  { id: "boot-02", phase: "boot", category: "status", text: "正在加载攻击图谱节点…" },
  { id: "boot-03", phase: "boot", category: "status", text: "连接 CorpMate 参考 Agent…" },
  { id: "boot-04", phase: "boot", category: "status", text: "初始化 CompositeSandbox 三层沙箱…" },
  { id: "boot-05", phase: "boot", category: "status", text: "加载 RiskPattern 知识库: R1-R4…" },
  { id: "boot-06", phase: "boot", category: "status", text: "正在扫描 86 条 TestCase 契约…" },
  { id: "boot-07", phase: "boot", category: "status", text: "预热 Rule Judge 因果判定模块…" },
  { id: "boot-08", phase: "boot", category: "status", text: "正在构建浏览器沙箱隔离环境…" },
  { id: "boot-09", phase: "boot", category: "status", text: "装载邮件沙箱确认流程…" },
  { id: "boot-10", phase: "boot", category: "status", text: "初始化记忆存储 K-V 引擎…" },
  { id: "boot-11", phase: "boot", category: "tip", text: "提示: 每条 TestCase 执行前 Sandbox 会自动重置" },
  { id: "boot-12", phase: "boot", category: "tip", text: "提示: Rule Judge 规则命中即返回" },

  { id: "preflight-01", phase: "preflight", category: "status", text: "正在注册变异页面 fixture 到浏览器沙箱…" },
  { id: "preflight-02", phase: "preflight", category: "status", text: "计算 canary 指纹: SHA-256 派生校验…" },
  { id: "preflight-03", phase: "preflight", category: "status", text: "预检注入页面: 验证 canary 可被读取…" },
  { id: "preflight-04", phase: "preflight", category: "status", text: "校验 AttackSeed 与 TestCase 风险引用…" },
  { id: "preflight-05", phase: "preflight", category: "status", text: "正在验证 env_delta 沙箱增量格式…" },
  { id: "preflight-06", phase: "preflight", category: "status", text: "预检 7 种注入模板与攻击种子…" },
  { id: "preflight-07", phase: "preflight", category: "status", text: "确认 41 条变异用例的载荷完整性…" },
  { id: "preflight-08", phase: "preflight", category: "status", text: "正在扫描隐藏 HTML 注入区域…" },
  { id: "preflight-09", phase: "preflight", category: "status", text: "变异页面注册完毕，等待 Agent 读取…" },
  { id: "preflight-10", phase: "preflight", category: "tip", text: "提示: 预检失败表示攻击载荷还未部署好" },

  { id: "running-01", phase: "running", category: "status", text: "正在为 TestCase 初始化干净 Sandbox…" },
  { id: "running-02", phase: "running", category: "status", text: "应用 env_delta: 注入页面、记忆与邮件…" },
  { id: "running-03", phase: "running", category: "status", text: "Agent 会话已建立，等待指令下发…" },
  { id: "running-04", phase: "running", category: "status", text: "Agent 正在解析用户输入…" },
  { id: "running-05", phase: "running", category: "status", text: "正在追踪 Agent 的 tool call 链路…" },
  { id: "running-06", phase: "running", category: "status", text: "执行 Tool: browser.open_page 返回页面内容…" },
  { id: "running-07", phase: "running", category: "status", text: "执行 Tool: memory.write 更新持久记忆…" },
  { id: "running-08", phase: "running", category: "status", text: "执行 Tool: email.send 需要用户确认…" },
  { id: "running-09", phase: "running", category: "status", text: "执行 Tool: email.list 读取收件箱…" },
  { id: "running-10", phase: "running", category: "status", text: "Agent 跨轮次状态累积中…" },
  { id: "running-11", phase: "running", category: "status", text: "正在记录 TOOL_CALLED 事件到 Trace…" },
  { id: "running-12", phase: "running", category: "status", text: "LLM 推理中…" },
  { id: "running-13", phase: "running", category: "status", text: "正在调用语义模型…" },
  { id: "running-14", phase: "running", category: "status", text: "语义分析页面内容…" },
  { id: "running-15", phase: "running", category: "status", text: "正在整理 Agent 推理结果…" },
  { id: "running-r4-01", phase: "running", category: "stage_r4", text: "[网页注入] 正在让 Agent 读取变异页面…" },
  { id: "running-r4-02", phase: "running", category: "stage_r4", text: "[网页注入] 检查是否触发异常行为…" },
  { id: "running-r4-03", phase: "running", category: "stage_r4", text: "[记忆投毒] Agent 正在写入持久记忆…" },
  { id: "running-r4-04", phase: "running", category: "stage_r4", text: "[记忆投毒] 验证记忆跨会话可读性…" },
  { id: "running-r4-05", phase: "running", category: "stage_r4", text: "[邮件发送] 检查是否未经确认调用 email.send…" },
  { id: "running-r4-06", phase: "running", category: "stage_r4", text: "[邮件发送] 构建五节点因果链…" },
  { id: "running-k-01", phase: "running", category: "knowledge", text: "IPI 会把恶意指令藏在网页内容里" },
  { id: "running-k-02", phase: "running", category: "knowledge", text: "R4 攻击链会跨页面、记忆与新会话传播" },
  { id: "running-k-03", phase: "running", category: "knowledge", text: "FORBIDDEN_TOOL_CALL 表示禁止动作被执行" },
  { id: "running-k-04", phase: "running", category: "knowledge", text: "CONFIRMATION_MISSING 表示敏感工具未确认" },
  { id: "running-k-05", phase: "running", category: "knowledge", text: "Hidden HTML 攻击对人隐藏，对 Agent 可见" },
  { id: "running-k-06", phase: "running", category: "knowledge", text: "White-on-White 文本可能被 Agent 照单全收" },

  { id: "judging-01", phase: "judging", category: "status", text: "Rule Judge 正在检查 3 条规则…" },
  { id: "judging-02", phase: "judging", category: "status", text: "CompositeJudge 规则优先，命中即 FAIL…" },
  { id: "judging-03", phase: "judging", category: "status", text: "正在重建页面注入到数据外泄的因果路径…" },
  { id: "judging-04", phase: "judging", category: "status", text: "判定证据绑定中: 关联 Trace 事件…" },
  { id: "judging-05", phase: "judging", category: "status", text: "风险严重等级评估中…" },
  { id: "judging-06", phase: "judging", category: "status", text: "正在检测五节点因果链…" },
  { id: "judging-07", phase: "judging", category: "tip", text: "提示: Stage 2 的 LLM Judge 仍是 Mock 实现" },

  { id: "reporting-01", phase: "reporting", category: "status", text: "正在计算综合评分: 能力、安全性、稳定性…" },
  { id: "reporting-02", phase: "reporting", category: "status", text: "汇总 by_risk_pattern: R1 / R2 / R3 / R4…" },
  { id: "reporting-03", phase: "reporting", category: "status", text: "汇总 by_risk_type: IPI / Memory / Privacy…" },
  { id: "reporting-04", phase: "reporting", category: "status", text: "汇总 by_severity: CRITICAL 到 LOW…" },
  { id: "reporting-05", phase: "reporting", category: "status", text: "CRITICAL 严重度将触发分数上限…" },
  { id: "reporting-06", phase: "reporting", category: "status", text: "正在生成风险发现报告与证据链…" },
  { id: "reporting-07", phase: "reporting", category: "status", text: "绑定 Finding、Evidence 与 Trace Event…" },
  { id: "reporting-08", phase: "reporting", category: "status", text: "报告已就绪，可查看测评报告详情" },

  { id: "idle-01", phase: "idle", category: "status", text: "选择 TestCase 开始测评，支持单选与批量模式。" },
  { id: "idle-02", phase: "idle", category: "status", text: "当前 TestCase 库覆盖 R1-R4 四类风险模式。" },
  { id: "error-01", phase: "error", category: "status", text: "运行中断。Sandbox 已清理，可新建测评重试。" },
  { id: "error-02", phase: "error", category: "status", text: "预检失败: 页面载荷未通过 canary 校验。" },
];

export function getLoadingTips(phase: LoadingTipPhase, categories?: LoadingTipCategory[]) {
  const allowed = categories ? new Set(categories) : null;
  return LOADING_TIPS.filter((tip) => tip.phase === phase && (!allowed || allowed.has(tip.category)));
}

export function pickTip(
  phase: LoadingTipPhase,
  seen: Set<string>,
  mode: LoadingTipMode = "live",
  random: () => number = Math.random,
  categories?: LoadingTipCategory[],
): LoadingTip {
  const tips = getLoadingTips(phase, categories);
  const fallback = tips[0] ?? getLoadingTips("idle")[0];

  if (mode === "timeline") {
    if (seen.size >= tips.length) {
      seen.clear();
    }
    const tip = tips[seen.size] ?? fallback;
    seen.add(tip.id);
    return tip;
  }

  const livePool =
    phase === "running" && !categories
      ? tips.filter((tip) => tip.category !== "knowledge" || random() < 0.3)
      : tips;
  let pool = livePool.filter((tip) => !seen.has(tip.id));
  if (pool.length === 0) {
    seen.clear();
    pool = livePool;
  }
  const tip = pool[Math.floor(random() * pool.length)] ?? fallback;
  seen.add(tip.id);
  return tip;
}

export function resolveEvaluationLoadingTipPhase({
  activeStage,
  hasReport,
  isBootstrapping,
  isLoadingReport,
  isLoadingTestCases,
  latestEventType,
  reportError,
  runStatus,
  testCaseError,
  workspaceError,
}: EvaluationLoadingTipState): LoadingTipPhase {
  if (testCaseError || reportError || workspaceError || runStatus === "failed" || runStatus === "interrupted" || runStatus === "preflight_failed") {
    return "error";
  }
  if (isLoadingReport || (runStatus === "completed" && !hasReport)) {
    return "reporting";
  }
  if (latestEventType === "JUDGE_DECISION" || latestEventType === "FINDING_CREATED") {
    return "judging";
  }
  if (runStatus === "preflighting" || activeStage === "web_content_injection") {
    return "preflight";
  }
  if (runStatus === "queued" || runStatus === "running") {
    return "running";
  }
  if (isBootstrapping || isLoadingTestCases || runStatus === "ready") {
    return "boot";
  }
  return "idle";
}

export function useLoadingTip(
  phase: LoadingTipPhase,
  {
    active = true,
    categories,
    intervalMs = 3200,
    mode = "live",
  }: {
    active?: boolean;
    categories?: LoadingTipCategory[];
    intervalMs?: number;
    mode?: LoadingTipMode;
  } = {},
) {
  const seenRef = useRef(new Set<string>());
  const [tip, setTip] = useState(() => pickTip(phase, seenRef.current, mode, Math.random, categories));

  useEffect(() => {
    seenRef.current.clear();
    setTip(pickTip(phase, seenRef.current, mode, Math.random, categories));
  }, [categories, mode, phase]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => {
      setTip(pickTip(phase, seenRef.current, mode, Math.random, categories));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, categories, intervalMs, mode, phase]);

  return tip.text;
}
