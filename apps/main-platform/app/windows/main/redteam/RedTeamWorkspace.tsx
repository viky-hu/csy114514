"use client";

import { AlertTriangle, CircleDashed, Play, RadioTower, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MIA_RAG_TOKEN_KEY } from "../../../lib/client/auth-adapter";
import {
  buildMockRedTeamEvents,
  createMockRedTeamConnection,
  createMockRedTeamReport,
  createMockRedTeamRun,
  type RedTeamConnection as Connection,
  type RedTeamEvent as RunEvent,
  type RedTeamReport as Report,
  type RedTeamRun as Run,
} from "./redteam-mock";

function authHeaders() {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem(MIA_RAG_TOKEN_KEY);
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function readJson<T>(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  authHeaders().forEach((value, key) => headers.set(key, value));
  const response = await fetch(input, { ...init, headers });
  const body = await response.json() as T | { error?: { message?: string }; detail?: string };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string }; detail?: string };
    const message = typeof errorBody.error?.message === "string" ? errorBody.error.message : typeof errorBody.detail === "string" ? errorBody.detail : "红队服务暂不可用";
    throw new Error(message);
  }
  return body as T;
}

const CONCLUSION_COPY = {
  exposure_confirmed: { title: "已证实暴露", detail: "至少一个 FAIL 样本未触发防御标签。请优先查看绕过证据。", tone: "danger" },
  coverage_incomplete: { title: "覆盖不足 / 结果不确定", detail: "错误、未触发或矛盾样本存在；零绕过不能等同于安全。", tone: "warning" },
  no_bypass_observed: { title: "已判定样本内未发现绕过", detail: "这是已覆盖样本的观察结论，并非对目标的绝对安全承诺。", tone: "safe" },
} as const;

export function RedTeamWorkspace({ activeAgentId, mockMode = false }: { activeAgentId: string; mockMode?: boolean }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [view, setView] = useState<"entry" | "running" | "report">("entry");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [config, setConfig] = useState({ rounds: 2, seed_count: 4, variants_per_seed: 2 });
  const activeConnection = connections.find((item) => item.agent_id === activeAgentId) ?? connections[0] ?? null;

  const refresh = async () => {
    if (mockMode) {
      const connection = createMockRedTeamConnection(activeAgentId);
      setConnections([connection]);
      setRuns([createMockRedTeamRun(connection)]);
      return;
    }
    const [nextConnections, nextRuns] = await Promise.all([
      readJson<Connection[]>(`/api/redteam/connections?agent_id=${encodeURIComponent(activeAgentId)}`),
      readJson<Run[]>("/api/redteam/runs"),
    ]);
    setConnections(nextConnections);
    setRuns(nextRuns);
  };

  useEffect(() => { void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "读取红队资源失败")); }, [activeAgentId, mockMode]);

  useEffect(() => {
    if (!mockMode || !activeRun || view !== "running") return;
    const playback = buildMockRedTeamEvents(activeRun);
    setEvents([]);
    const timers = playback.map((event, index) => window.setTimeout(() => {
      setEvents((current) => [...current, event]);
    }, index * 420));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeRun?.run_id, mockMode, view]);

  useEffect(() => {
    if (!activeRun || !["queued", "running"].includes(activeRun.status)) return;
    let closed = false;
    let source: EventSource | null = null;
    const connect = async () => {
      const { ticket } = await readJson<{ ticket: string }>("/api/redteam/sse-ticket", { method: "POST" });
      if (closed) return;
      source = new EventSource(`/api/redteam/runs/${encodeURIComponent(activeRun.run_id)}/events?after=${events.at(-1)?.seq ?? 0}&ticket=${encodeURIComponent(ticket)}`);
      source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as Omit<RunEvent, "seq">;
        const seq = Number(message.lastEventId.split(":").at(-1));
        if (!Number.isInteger(seq)) return;
        setEvents((current) => current.some((item) => item.seq === seq) ? current : [...current, { ...event, seq }]);
      } catch { /* Ignore malformed replay events; the run snapshot remains authoritative. */ }
      };
      source.onerror = () => {
        source?.close();
        void readJson<Run>(`/api/redteam/runs/${encodeURIComponent(activeRun.run_id)}`).then((nextRun) => {
        setActiveRun(nextRun);
        if (nextRun.report_available) void openReport(nextRun.run_id);
        }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "实时事件流暂时中断"));
      };
    };
    void connect().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "无法建立实时事件流"));
    return () => { closed = true; source?.close(); };
  }, [activeRun?.run_id, activeRun?.status]);

  const openReport = async (runId: string) => {
    if (mockMode) {
      const connection = activeConnection ?? createMockRedTeamConnection(activeAgentId);
      const nextRun = runs.find((item) => item.run_id === runId) ?? createMockRedTeamRun(connection);
      setActiveRun(nextRun); setEvents(buildMockRedTeamEvents(nextRun)); setReport(createMockRedTeamReport(nextRun)); setView("report"); setError(null);
      return;
    }
    try {
      const [nextRun, nextReport] = await Promise.all([
        readJson<Run>(`/api/redteam/runs/${encodeURIComponent(runId)}`),
        readJson<Report>(`/api/redteam/runs/${encodeURIComponent(runId)}/report`),
      ]);
      setActiveRun(nextRun); setReport(nextReport); setView("report"); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "读取演练报告失败"); }
  };

  const start = async () => {
    if (!activeConnection) return;
    setStarting(true); setError(null);
    try {
      if (mockMode) {
        const run = createMockRedTeamRun(activeConnection);
        setRuns((current) => [run, ...current.filter((item) => item.run_id !== run.run_id)]); setActiveRun(run); setEvents([]); setReport(null); setView("running");
        return;
      }
      const run = await readJson<Run>("/api/redteam/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connection_id: activeConnection.connection_id, config }) });
      setRuns((current) => [run, ...current]); setActiveRun(run); setEvents([]); setReport(null); setView("running");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "启动红队演练失败"); }
    finally { setStarting(false); }
  };

  const visibleEvents = events.slice(-10).reverse();
  const reportCopy = report ? CONCLUSION_COPY[report.conclusion] : null;
  const outcome = report?.outcome_summary ?? {};
  const weightRows = useMemo(() => report?.weight_snapshots?.flatMap((snapshot) => Object.entries(snapshot.weights_after).map(([strategy, weight]) => ({ round: snapshot.round, strategy, weight }))) ?? [], [report]);

  return <section className={`redteam-page is-${view}`} aria-label="红队演练工作区">
    <header className="redteam-header"><div><span>ADAPTIVE RED TEAM</span><h1>{view === "entry" ? "红队演练" : view === "running" ? "演练进程" : "演练报告"}</h1><p>{view === "entry" ? "固定种子集，按每轮权重最高的三种策略持续变异与验证。" : activeRun ? `${activeRun.agent_id} · ${activeRun.run_id.slice(-8)}` : "运行专属证据与覆盖度结论"}</p></div><div className="redteam-header-actions"><span className={`redteam-mode-label ${mockMode ? "is-mock" : "is-live"}`}>{mockMode ? "MOCK · 无认证回放" : "LIVE · BFF 连接"}</span>{view !== "entry" && <button type="button" className="redteam-ghost" onClick={() => setView("entry")}>返回入口</button>}<button type="button" className="redteam-ghost" onClick={() => void refresh()}>刷新历史</button></div></header>
    {error && <div className="redteam-error"><AlertTriangle size={16} />{error}</div>}
    {view === "entry" && <div className="redteam-entry">
      <article className="redteam-command-card"><span className="redteam-kicker">TARGET CONNECTION</span><h2>{activeConnection ? activeConnection.agent_id : "尚未配置演练连接"}</h2><p>{activeConnection ? `${activeConnection.adapter_metadata.environment ?? "unknown"} · Adapter ${activeConnection.adapter_metadata.protocol_version ?? "unknown"}` : "请先在初始接口登记并验证专用测试环境的 HTTP Adapter。"}</p><dl><div><dt>种子选择</dt><dd>仅在运行开始时选择一次</dd></div><div><dt>策略规则</dt><dd>每轮固定取权重最高三种</dd></div><div><dt>目标范围</dt><dd>专用测试环境，不连接生产或内网</dd></div></dl></article>
      <form className="redteam-config" onSubmit={(event) => { event.preventDefault(); void start(); }}><label>变异轮次<input type="number" min="1" max="10" value={config.rounds} onChange={(event) => setConfig({ ...config, rounds: Number(event.target.value) })} /></label><label>固定种子数<input type="number" min="1" max="20" value={config.seed_count} onChange={(event) => setConfig({ ...config, seed_count: Number(event.target.value) })} /></label><label>每种子变体<input type="number" min="1" max="5" value={config.variants_per_seed} onChange={(event) => setConfig({ ...config, variants_per_seed: Number(event.target.value) })} /></label><button className="redteam-primary" disabled={!activeConnection || starting} type="submit">{starting ? <CircleDashed className="redteam-spin" size={17} /> : <Play size={17} />}{starting ? "正在创建运行" : "开始红队演练"}</button></form>
      <RunHistory runs={runs} onOpen={(run) => { if (run.report_available) void openReport(run.run_id); else { setActiveRun(run); setEvents([]); setView("running"); } }} />
    </div>}
    {view === "running" && <div className="redteam-running"><section className="redteam-progress"><div className="redteam-progress-head"><RadioTower size={18} /><div><b>{activeRun?.status === "queued" ? "等待演练资源" : "红队正在执行"}</b><small>当前轮次 {activeRun?.current_round ?? 0} / {activeRun?.config.rounds ?? config.rounds}</small></div></div><div className="redteam-rail"><span className={events.some((event) => event.type === "SEEDS_SELECTED") ? "is-done" : ""}>选取种子</span><span className={events.some((event) => event.type === "VARIANT_CREATED") ? "is-done" : ""}>生成变体</span><span className={events.some((event) => event.type === "VARIANT_EVALUATED") ? "is-done" : ""}>沙箱测评</span><span className={events.some((event) => event.type === "WEIGHTS_UPDATED") ? "is-done" : ""}>调整权重</span></div></section><section className="redteam-event-feed"><header><span>LIVE EVENT STREAM</span><b>{events.length}</b></header>{visibleEvents.length ? visibleEvents.map((event) => <div key={`${event.run_id}:${event.seq}`}><time>{new Date(event.timestamp).toLocaleTimeString("zh-CN")}</time><strong>{event.type}</strong><small>{event.payload.strategy as string ?? event.payload.message as string ?? event.payload.conclusion as string ?? "已记录"}</small></div>) : <p>等待后端发布第一条可重放事件…</p>}</section>{activeRun?.status === "failed" && <div className="redteam-error"><ShieldAlert size={17} />{activeRun.error_message || "运行失败，请检查适配器测试环境。"}</div>}{activeRun?.report_available && <button className="redteam-primary" type="button" onClick={() => void openReport(activeRun.run_id)}>查看运行报告</button>}</div>}
    {view === "report" && report && reportCopy && <div className="redteam-report"><section className={`redteam-conclusion is-${reportCopy.tone}`}><div>{reportCopy.tone === "safe" ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}</div><div><span>CONCLUSION · EVIDENCE QUALIFIED</span><h2>{reportCopy.title}</h2><p>{reportCopy.detail}</p></div></section><section className="redteam-matrix" aria-label="判定结果矩阵">{[["confirmed_bypass", "已证实绕过"], ["defense_success", "防守成功"], ["not_exercised", "未充分触发"], ["execution_error", "执行错误"], ["inconclusive", "结果不确定"]].map(([key, label]) => <div key={key}><span>{label}</span><b>{outcome[key] ?? 0}</b></div>)}</section><RedTeamVisualizations report={report} /><section className="redteam-report-grid"><article><header><span>STRATEGY EVOLUTION</span><h3>策略与最终权重</h3></header>{report.strategy_effectiveness?.map((item) => <div className="redteam-strategy" key={item.strategy}><span>{item.strategy}</span><i style={{ width: `${Math.max(8, item.weight_final * 32)}%` }} /><small>{item.variants} 变体 · {item.bypasses} 绕过 · {item.weight_final.toFixed(2)}</small></div>)}</article><article><header><span>ROUND COVERAGE</span><h3>轮次与已选策略</h3></header>{report.round_evolution?.map((item) => <div className="redteam-round" key={item.round}><b>R{item.round}</b><span>{item.variants} 变体</span><small>{item.active_strategies.join(" · ")}</small></div>)}</article></section><section className="redteam-evidence"><header><span>BYPASS EVIDENCE</span><h3>已证实绕过</h3></header>{report.bypasses?.length ? report.bypasses.map((item) => <div key={item.variant_id}><strong>{item.strategy}</strong><span>{item.seed_id}</span><small>{item.risk_pattern}</small></div>) : <p>本次没有已证实绕过；请结合上方覆盖度结论判断结果可信度。</p>}</section><section className="redteam-weight-data"><span>WEIGHT SNAPSHOTS</span><p>{weightRows.map((item) => `R${item.round} ${item.strategy} ${item.weight.toFixed(2)}`).join(" · ") || "尚无权重快照"}</p></section></div>}
  </section>;
}

function RunHistory({ runs, onOpen }: { runs: Run[]; onOpen: (run: Run) => void }) {
  return <section className="redteam-history"><header><span>RUN HISTORY</span><h2>我的演练记录</h2></header>{runs.length ? runs.slice(0, 5).map((run) => <button key={run.run_id} type="button" onClick={() => onOpen(run)}><span>{run.agent_id}</span><b>{run.status === "completed" ? "已完成" : run.status === "failed" ? "失败" : "进行中"}</b><small>{run.run_id.slice(-8)}</small></button>) : <p>尚无运行记录。</p>}</section>;
}

function RedTeamVisualizations({ report }: { report: Report }) {
  const strategies = report.strategy_effectiveness ?? [];
  const rounds = report.round_evolution ?? [];
  const snapshots = report.weight_snapshots ?? [];
  const defenseSuccess = report.outcome_summary.defense_success ?? 0;
  const bypasses = report.outcome_summary.confirmed_bypass ?? 0;
  return <section className="redteam-visual-grid" aria-label="红队演练可视化">
    <figure><figcaption><span>STRATEGY MAP</span><b>策略覆盖</b></figcaption><svg viewBox="0 0 240 116" role="img" aria-label="策略覆盖图"><path className="rt-viz-grid" d="M18 94H222M18 63H222M18 32H222" />{strategies.map((item, index) => <g key={item.strategy}><path className="rt-viz-strategy" d={`M28 ${90 - index * 24}H${62 + item.weight_final * 220}L${78 + item.weight_final * 220} ${82 - index * 24}`} /><text x="28" y={108 - index * 24}>{item.strategy.slice(0, 10)}</text></g>)}</svg></figure>
    <figure><figcaption><span>ROUND COVERAGE</span><b>轮次覆盖</b></figcaption><svg viewBox="0 0 240 116" role="img" aria-label="轮次覆盖图"><circle className="rt-viz-ring" cx="62" cy="58" r="33" /><circle className="rt-viz-ring is-filled" cx="62" cy="58" r="33" pathLength="100" strokeDasharray={`${Math.min(100, (rounds.length / 3) * 100)} 100`} /><text x="48" y="62">{rounds.length}R</text>{rounds.map((round, index) => <g key={round.round}><rect className="rt-viz-block" x={116 + index * 44} y={80 - round.variants * 5} width="28" height={round.variants * 5} /><text x={118 + index * 44} y="104">R{round.round}</text></g>)}</svg></figure>
    <figure><figcaption><span>DEFENSE INTERCEPTION</span><b>防守截获</b></figcaption><svg viewBox="0 0 240 116" role="img" aria-label="防守截获图"><path className="rt-viz-route" d="M20 72H82L104 48H214" /><path className="rt-viz-intercept" d="M138 28V82M126 40L138 28L150 40" /><circle className="rt-viz-node" cx="82" cy="72" r="6" /><circle className="rt-viz-node is-danger" cx="194" cy="48" r="6" /><text x="20" y="100">{defenseSuccess} BLOCKED</text><text x="151" y="100">{bypasses} BYPASS</text></svg></figure>
    <figure><figcaption><span>WEIGHT EVOLUTION</span><b>权重演进</b></figcaption><svg viewBox="0 0 240 116" role="img" aria-label="策略权重演进图"><path className="rt-viz-grid" d="M18 94H222M18 56H222M18 18H222" />{snapshots.map((snapshot, index) => <g key={snapshot.round}>{Object.values(snapshot.weights_after).slice(0, 3).map((weight, strategyIndex) => <circle key={strategyIndex} className={`rt-viz-weight w-${strategyIndex}`} cx={56 + index * 104} cy={94 - weight * 110} r="4" />)}<text x={48 + index * 104} y="108">R{snapshot.round}</text></g>)}<path className="rt-viz-weight-line" d="M56 34L160 27" /></svg></figure>
  </section>;
}
