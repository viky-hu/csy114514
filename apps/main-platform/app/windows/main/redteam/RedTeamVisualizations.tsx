"use client";

import { useGSAP } from "@gsap/react";
import ReactECharts from "echarts-for-react";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import type { EChartsOption, EChartsType } from "echarts";
import type { RedTeamReport as Report } from "./redteam-mock";

gsap.registerPlugin(useGSAP);

const COLORS = ["#3152f4", "#2e9b63", "#c43d4b", "#8a5cf6", "#d18b24", "#65738b"];
const FONT_FAMILY = 'var(--main-body-font, "Noto Sans SC", sans-serif)';
const AXIS_COLOR = "rgba(17,22,34,.58)";
const GRID_COLOR = "rgba(17,22,34,.1)";
const BASE_TEXT_STYLE = { fontFamily: FONT_FAMILY, color: "#111622" };
const ROUND_PROGRESS_CENTER: [string, string] = ["18%", "52%"];
const clamp = (value: unknown) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
const safeCount = (value: unknown) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const label = (value: string) => value.replaceAll("_", " ").replace("prompt injection", "提示注入").replace("memory poisoning", "记忆污染").replace("tool misuse", "工具滥用");
const escapeHtml = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const unit = (value: number, suffix: string) => `${Math.round(value)}${suffix}`;
const formatWeightTick = (value: number) => value === 0 || value === 1 ? value.toFixed(1) : `${Number(value.toFixed(2))}`;

export function normalizeRedTeamChartData(report: Report) {
  const strategies = (report.strategy_effectiveness ?? []).slice(0, 6).map((item) => ({ ...item, weight_final: clamp(item.weight_final), variants: safeCount(item.variants), bypasses: safeCount(item.bypasses) }));
  const rounds = (report.round_evolution ?? []).map((item) => ({ ...item, variants: safeCount(item.variants) }));
  const snapshots = report.weight_snapshots ?? [];
  const strategyNames = Array.from(new Set([...strategies.map((item) => item.strategy), ...snapshots.flatMap((item) => Object.keys(item.weights_after ?? {}))])).slice(0, 6);
  return { strategies, rounds, snapshots, strategyNames, completedRounds: rounds.length, plannedRounds: rounds.length };
}

export function RedTeamVisualizations({ report }: { report: Report }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.from(".rt-chart", { autoAlpha: 0, y: reduced ? 0 : 8, duration: reduced ? 0 : 0.55, stagger: 0.08, ease: "power2.out" });
  }, { scope: root, dependencies: [report.run_id] });
  return <section ref={root} className="redteam-visual-grid" aria-label="红队演练核心证据图"><StrategyCoverageChart report={report} /><RoundCoverageChart report={report} /><DefenseInterceptionChart report={report} /><WeightEvolutionChart report={report} /></section>;
}

type ChartVariant = "strategy" | "round" | "defense" | "weight";

function Frame({ title, note, option, variant, empty, emptyText = "暂无数据" }: { title: string; note: string; option: EChartsOption; variant: ChartVariant; empty?: boolean; emptyText?: string }) {
  const chartRef = useRef<EChartsType | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => chartRef.current?.resize({ silent: true }));
    observer.observe(container);
    return () => { observer.disconnect(); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);
  return <figure className={`rt-chart rt-chart-${variant}`}><figcaption><span>证据图</span><b>{title}</b><small>{note}</small></figcaption><div ref={canvasRef} className="rt-chart-canvas">{empty ? <p className="rt-chart-empty">{emptyText}</p> : <ReactECharts option={option} notMerge lazyUpdate style={{ width: "100%", height: "100%" }} opts={{ renderer: "canvas" }} onChartReady={(instance) => { chartRef.current = instance; }} />}</div></figure>;
}

const commonOption = (): Pick<EChartsOption, "animation" | "textStyle" | "tooltip"> => ({
  animation: false,
  textStyle: BASE_TEXT_STYLE,
  tooltip: { confine: true, textStyle: BASE_TEXT_STYLE },
});

export function StrategyCoverageChart({ report }: { report: Report }) {
  const { strategies } = normalizeRedTeamChartData(report);
  const option: EChartsOption = {
    ...commonOption(),
    grid: { left: 122, right: 56, top: 16, bottom: 46, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    tooltip: { confine: true, trigger: "axis", axisPointer: { type: "shadow" }, textStyle: BASE_TEXT_STYLE, formatter: (params) => { const item = Array.isArray(params) ? params[0] : params; const row = strategies[item?.dataIndex ?? 0]; return row ? `${escapeHtml(label(row.strategy))}<br/>最终权重 ${row.weight_final.toFixed(2)}<br/>${unit(row.variants, " 个")}变体 · ${unit(row.bypasses, " 次")}绕过` : ""; } },
    xAxis: { type: "value", name: "最终权重", nameLocation: "middle", nameGap: 30, min: 0, max: 1, interval: 0.25, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { show: false }, axisLabel: { color: AXIS_COLOR, formatter: formatWeightTick, fontFamily: FONT_FAMILY }, splitLine: { lineStyle: { color: GRID_COLOR } } },
    yAxis: { type: "category", data: strategies.map((item) => label(item.strategy)), inverse: true, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { show: false }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY, width: 108, overflow: "break", lineHeight: 16 } },
    series: [{ type: "bar", data: strategies.map((item) => item.weight_final), barMaxWidth: 22, itemStyle: { color: COLORS[0], borderRadius: [0, 3, 3, 0] }, label: { show: true, position: "right", color: "#111622", fontFamily: FONT_FAMILY, formatter: (params) => Number(params.value).toFixed(2) } }],
  };
  return <Frame title="策略覆盖" note="最终权重决定本轮探索优先级 · 横轴：最终权重（0–1）" option={option} variant="strategy" empty={!strategies.length} emptyText="暂无策略数据" />;
}

export function RoundCoverageChart({ report }: { report: Report }) {
  const { rounds, completedRounds, plannedRounds } = normalizeRedTeamChartData(report);
  const option: EChartsOption = {
    ...commonOption(),
    grid: { left: "50%", right: 20, top: 24, bottom: 48, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    graphic: [{ type: "group", left: ROUND_PROGRESS_CENTER[0], top: ROUND_PROGRESS_CENTER[1], width: 0, height: 0, bounding: "raw", z: 10, children: [{ type: "text", x: 0, y: 0, style: { ...BASE_TEXT_STYLE, text: `{value|${completedRounds}/${plannedRounds || 0}}\n{label|完成轮次}`, align: "center", verticalAlign: "middle", rich: { value: { fontFamily: FONT_FAMILY, fill: "#111622", fontSize: 18, fontWeight: 600, lineHeight: 22 }, label: { fontFamily: FONT_FAMILY, fill: "rgba(17,22,34,.56)", fontSize: 10, lineHeight: 16 } } } }] }],
    xAxis: { type: "category", name: "轮次", nameLocation: "middle", nameGap: 31, data: rounds.map((item) => `R${item.round}`), axisTick: { alignWithLabel: true }, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY } },
    yAxis: { type: "value", name: "变体数（个）", nameLocation: "middle", nameGap: 38, min: 0, splitNumber: 3, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { show: false }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY, formatter: (value: number) => `${value}` }, splitLine: { lineStyle: { color: GRID_COLOR } } },
    series: [{ type: "pie", center: ROUND_PROGRESS_CENTER, radius: ["56%", "68%"], silent: true, tooltip: { show: false }, label: { show: false }, labelLine: { show: false }, data: [{ value: completedRounds, itemStyle: { color: COLORS[0] } }, { value: Math.max(0, plannedRounds - completedRounds), itemStyle: { color: "rgba(17,22,34,.12)" } }] }, { type: "bar", data: rounds.map((item) => item.variants), barMaxWidth: 24, itemStyle: { color: "rgba(49,82,244,.72)", borderRadius: [3, 3, 0, 0] }, label: { show: true, position: "top", color: "#111622", fontFamily: FONT_FAMILY, formatter: (params) => `${params.value}` } }],
    tooltip: { confine: true, trigger: "axis", axisPointer: { type: "shadow" }, textStyle: BASE_TEXT_STYLE, formatter: (params) => { const item = Array.isArray(params) ? params.find((entry) => entry.seriesType === "bar") : params; const row = rounds[item?.dataIndex ?? 0]; return row ? `${escapeHtml(`R${row.round}`)}<br/>变体数 ${unit(row.variants, " 个")}` : ""; } },
  };
  return <Frame title="轮次覆盖" note="左侧为完成进度，右侧为每轮变体数量" option={option} variant="round" empty={!rounds.length} emptyText="暂无轮次数据" />;
}

export function DefenseInterceptionChart({ report }: { report: Report }) {
  const blocked = safeCount(report.outcome_summary?.defense_success);
  const bypass = safeCount(report.outcome_summary?.confirmed_bypass);
  const total = Object.values(report.outcome_summary ?? {}).reduce((sum, value) => sum + safeCount(value), 0);
  const other = Math.max(0, total - blocked - bypass);
  const rows = [{ name: "防守成功", value: blocked, color: COLORS[1] }, { name: "已证实绕过", value: bypass, color: COLORS[2] }, { name: "其他结果", value: other, color: "#8a929f" }];
  const option: EChartsOption = {
    ...commonOption(),
    grid: { left: 92, right: 44, top: 18, bottom: 48, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    xAxis: { type: "value", name: "结果数量（次）", nameLocation: "middle", nameGap: 30, min: 0, max: Math.max(1, ...rows.map((row) => row.value)), splitNumber: 3, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { show: false }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY, formatter: (value: number) => `${value}` }, splitLine: { lineStyle: { color: GRID_COLOR } } },
    yAxis: { type: "category", data: rows.map((row) => row.name), inverse: true, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { show: false }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY } },
    series: [{ type: "bar", data: rows.map((row) => ({ value: row.value, itemStyle: { color: row.color, borderRadius: [0, 3, 3, 0] } })), barMaxWidth: 28, label: { show: true, position: "right", color: "#111622", fontFamily: FONT_FAMILY, formatter: (params) => { const value = Number(params.value); const ratio = total ? Math.round((value / total) * 100) : 0; return `${value} 次 · ${ratio}%`; } } }],
    tooltip: { confine: true, trigger: "item", textStyle: BASE_TEXT_STYLE, formatter: (params) => { const item = Array.isArray(params) ? params[0] : params; if (!item) return ""; const value = Number(item.value); const ratio = total ? Math.round((value / total) * 100) : 0; return `${escapeHtml(item.name)}<br/>${value} 次 · ${ratio}%`; } },
  };
  return <Frame title="防守截获" note="按结果类型比较拦截、绕过与其他结果" option={option} variant="defense" empty={!total} emptyText="暂无结果数据" />;
}

export function WeightEvolutionChart({ report }: { report: Report }) {
  const { snapshots, strategyNames } = normalizeRedTeamChartData(report);
  const option: EChartsOption = {
    ...commonOption(),
    color: COLORS,
    grid: { left: 66, right: 28, top: strategyNames.length ? 58 : 18, bottom: 50, outerBoundsMode: "same", outerBoundsContain: "axisLabel" },
    legend: { top: 4, left: "center", type: "scroll", itemWidth: 14, itemHeight: 8, textStyle: { ...BASE_TEXT_STYLE, fontFamily: FONT_FAMILY, fontSize: 10 }, data: strategyNames.map(label) },
    xAxis: { type: "category", name: "轮次", nameLocation: "middle", nameGap: 31, boundaryGap: false, data: snapshots.map((item) => `R${item.round}`), axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { alignWithLabel: true }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY } },
    yAxis: { type: "value", name: "策略权重（0–1）", nameLocation: "middle", nameGap: 44, min: 0, max: 1, interval: 0.25, axisLine: { lineStyle: { color: AXIS_COLOR } }, axisTick: { show: false }, axisLabel: { color: AXIS_COLOR, fontFamily: FONT_FAMILY, formatter: (value: number) => value === 0 ? "0" : formatWeightTick(value) }, splitLine: { lineStyle: { color: GRID_COLOR } } },
    tooltip: { confine: true, trigger: "axis", axisPointer: { type: "cross" }, textStyle: BASE_TEXT_STYLE, formatter: (params) => { const items = Array.isArray(params) ? params : [params]; const head = escapeHtml(items[0]?.name ?? ""); return [head, ...items.map((item) => `${escapeHtml(item.seriesName)}：${Number(item.value).toFixed(2)}`)].join("<br/>"); } },
    series: strategyNames.map((strategy) => ({ name: label(strategy), type: "line", smooth: 0.2, showSymbol: true, symbolSize: 7, connectNulls: false, data: snapshots.map((item) => item.weights_after?.[strategy] == null ? null : clamp(item.weights_after[strategy])) })),
  };
  return <Frame title="权重演进" note="各策略权重随轮次变化 · 纵轴：策略权重（0–1）" option={option} variant="weight" empty={!snapshots.length || !strategyNames.length} emptyText="暂无权重快照" />;
}
