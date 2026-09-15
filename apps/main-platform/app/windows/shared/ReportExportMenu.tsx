"use client";

import { Check, Download, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ExportKind = "evaluation" | "comparison" | "redteam";
type ExportFormat = "txt" | "markdown" | "pdf";
const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "pdf", label: "PDF" }, { value: "markdown", label: "Markdown" }, { value: "txt", label: "TXT" },
];

export function ReportExportMenu({ kind, id, ready, className = "" }: { kind: ExportKind; id?: string | null; ready: boolean; className?: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState<ExportFormat | null>(null); const [error, setError] = useState<string | null>(null); const [failedFormat, setFailedFormat] = useState<ExportFormat | null>(null); const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; window.addEventListener("mousedown", close); return () => window.removeEventListener("mousedown", close); }, [open]);
  if (!ready || !id) return null;
  const download = async (format: ExportFormat) => {
    setBusy(format); setError(null); setFailedFormat(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const mockParam = id.startsWith("mock-") ? "&mock=1" : "";
      const response = await fetch(`/api/reports/export?kind=${kind}&id=${encodeURIComponent(id)}&format=${format}${mockParam}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { message?: string } } | null; throw new Error(body?.error?.message || "报告导出失败，请重试"); }
      const blob = await response.blob(); const disposition = response.headers.get("Content-Disposition") || ""; const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `${kind}-report.${format === "markdown" ? "md" : format}`; const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setOpen(false);
    } catch (cause) { setFailedFormat(format); setError(cause instanceof DOMException && cause.name === "AbortError" ? "报告导出超时，请重试" : cause instanceof Error ? cause.message : "报告导出失败，请重试"); } finally { window.clearTimeout(timeout); setBusy(null); }
  };
  return <div ref={root} className={`report-export-menu ${className}`}>
    <button type="button" className="report-export-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} disabled={Boolean(busy)}>{busy ? <LoaderCircle className="report-export-spin" size={15} /> : <Download size={15} />}<span>导出报告</span></button>
    {open && <div className="report-export-popover" role="menu" aria-label="报告导出格式">{FORMATS.map((item) => <button key={item.value} type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); void download(item.value); }}>{busy === item.value ? <LoaderCircle className="report-export-spin" size={14} /> : <Check size={14} className="report-export-check" />}{item.label}</button>)}</div>}
    {error && failedFormat && <p className="report-export-error" role="status">{error}<button type="button" onClick={() => void download(failedFormat)}>重试 {failedFormat.toUpperCase()}</button></p>}
  </div>;
}
