import { buildAgentEvalBackendUrl } from "../../../lib/server/backend";
import { forwardRedTeamJson } from "../../../lib/server/redteam-bff";
import {
  buildComparisonSnapshot,
  buildEvaluationSnapshot,
  buildRedTeamSnapshot,
  renderMarkdown,
  renderPrintHtml,
  renderTxt,
  type ReportSnapshot,
} from "../../../lib/server/report-export";
import { buildMockReportSnapshot } from "../../../lib/server/report-mock";

export const runtime = "nodejs";

type Kind = "evaluation" | "comparison" | "redteam";
type Format = "txt" | "markdown" | "pdf";
const EXPORT_TIMEOUT_MS = 20_000;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message, details: {} } }, { status });
}

function validSegment(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value));
}

async function readJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw Object.assign(new Error(body?.error?.message || "报告数据读取失败"), { status: response.status });
  }
  return response.json() as Promise<unknown>;
}

async function fetchSnapshot(request: Request, kind: Kind, id: string, mock: boolean): Promise<ReportSnapshot> {
  if (mock) {
    if (!id.startsWith("mock-")) throw Object.assign(new Error("Mock 报告标识无效"), { status: 400 });
    return buildMockReportSnapshot(kind, id);
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(EXPORT_TIMEOUT_MS)]);
  if (kind === "evaluation") {
    const base = encodeURIComponent(id);
    const [report, run, trace] = await Promise.all([
      readJson(buildAgentEvalBackendUrl(`/evaluations/${base}/report`), signal),
      readJson(buildAgentEvalBackendUrl(`/evaluations/${base}`), signal),
      readJson(buildAgentEvalBackendUrl(`/evaluations/${base}/trace`), signal).catch(() => null),
    ]);
    if ((run as { status?: string }).status !== "completed" || !(report as { report_id?: string }).report_id) {
      throw Object.assign(new Error("测评报告尚未完成"), { status: 409 });
    }
    return buildEvaluationSnapshot(report as never, run as never, trace as never);
  }
  if (kind === "comparison") {
    const base = encodeURIComponent(id);
    const [report, testCases] = await Promise.all([
      readJson(buildAgentEvalBackendUrl(`/evaluations/comparisons/${base}/report`), signal),
      readJson(buildAgentEvalBackendUrl("/test-cases"), signal),
    ]);
    if ((report as { status?: string }).status !== "completed") {
      throw Object.assign(new Error("对比报告尚未完成"), { status: 409 });
    }
    return buildComparisonSnapshot(report as never, testCases as never[]);
  }
  const requestFor = (path: string) => new Request(buildAgentEvalBackendUrl(path), { headers: request.headers, signal });
  const runUrl = requestFor(`/redteam/runs/${encodeURIComponent(id)}`);
  const reportUrl = requestFor(`/redteam/runs/${encodeURIComponent(id)}/report`);
  const evidenceUrl = requestFor(`/redteam/runs/${encodeURIComponent(id)}/evidence`);
  const [runResponse, reportResponse, evidenceResponse] = await Promise.all([
    forwardRedTeamJson(runUrl, `/redteam/runs/${encodeURIComponent(id)}`),
    forwardRedTeamJson(reportUrl, `/redteam/runs/${encodeURIComponent(id)}/report`),
    forwardRedTeamJson(evidenceUrl, `/redteam/runs/${encodeURIComponent(id)}/evidence`),
  ]);
  if (runResponse instanceof Response && !runResponse.ok) throw Object.assign(new Error("红队运行数据读取失败"), { status: runResponse.status });
  if (reportResponse instanceof Response && !reportResponse.ok) throw Object.assign(new Error("红队报告尚未完成"), { status: reportResponse.status });
  if (evidenceResponse instanceof Response && !evidenceResponse.ok) throw Object.assign(new Error("红队证据读取失败"), { status: evidenceResponse.status });
  const [run, report, evidence] = await Promise.all([
    (runResponse as Response).json(), (reportResponse as Response).json(), (evidenceResponse as Response).json(),
  ]);
  if ((run as { status?: string }).status !== "completed") {
    throw Object.assign(new Error("红队演练尚未完成"), { status: 409 });
  }
  return buildRedTeamSnapshot(run, report, Array.isArray(evidence) ? evidence : []);
}

async function pdfResponse(snapshot: ReportSnapshot, filename: string) {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true, timeout: EXPORT_TIMEOUT_MS });
    try {
      const page = await browser.newPage();
      await page.setContent(renderPrintHtml(snapshot), { waitUntil: "domcontentloaded", timeout: EXPORT_TIMEOUT_MS });
      const pdf = await page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<div></div>", footerTemplate: "<div style='width:100%;font-size:8px;color:#697586;text-align:right;padding:0 16mm'><span class='pageNumber'></span> / <span class='totalPages'></span></div>", preferCSSPageSize: true, margin: { top: "18mm", bottom: "16mm", left: "16mm", right: "16mm" } });
      return new Response(new Uint8Array(pdf) as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` } });
    } finally { await browser.close(); }
  } catch {
    return errorResponse(503, "PDF_RENDERER_UNAVAILABLE", "PDF 渲染器暂不可用，请重试或先导出 TXT/Markdown。");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  const format = url.searchParams.get("format") as Format | null;
  const mock = url.searchParams.get("mock") === "1";
  if (!["evaluation", "comparison", "redteam"].includes(kind ?? "") || !validSegment(id) || !["txt", "markdown", "pdf"].includes(format ?? "")) {
    return errorResponse(400, "INVALID_EXPORT_PARAMETERS", "kind、id 和 format 参数无效。");
  }
  try {
    const snapshot = await fetchSnapshot(request, kind as Kind, id, mock);
    const extension = format === "markdown" ? "md" : format;
    const filename = `${snapshot.kind}-${snapshot.id}.${extension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (format === "pdf") return pdfResponse(snapshot, filename);
    const body = format === "markdown" ? renderMarkdown(snapshot) : renderTxt(snapshot);
    return new Response(body, { headers: { "Content-Type": format === "markdown" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
    return errorResponse(status, status === 409 ? "REPORT_NOT_READY" : "REPORT_EXPORT_FAILED", error instanceof Error ? error.message : "报告导出失败，请重试。");
  }
}
