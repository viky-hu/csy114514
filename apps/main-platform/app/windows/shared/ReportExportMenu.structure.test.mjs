import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared export menu offers the three report formats", async () => {
  const source = await readFile(new URL("./ReportExportMenu.tsx", import.meta.url), "utf8");
  assert.match(source, /导出报告/);
  assert.match(source, /PDF/);
  assert.match(source, /Markdown/);
  assert.match(source, /TXT/);
  assert.match(source, /api\/reports\/export/);
  assert.match(source, /event\.stopPropagation\(\)/);
});

test("all report workspaces use the shared menu", async () => {
  const paths = [
    "../main/evaluation/EvaluationReportWorkspace.tsx",
    "../main/evaluation/EvaluationComparisonWorkspace.tsx",
    "../main/redteam/RedTeamWorkspace.tsx",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /ReportExportMenu/);
  }
});

test("evaluation export trigger matches the red-team hover treatment", async () => {
  const source = await readFile(new URL("../../styles/window-3-evaluation.css", import.meta.url), "utf8");
  assert.match(source, /\.evaluation-page \.report-export-trigger\s*\{[^}]*background:\s*var\(--evaluation-blue\)/s);
  assert.match(source, /\.evaluation-page \.report-export-trigger:hover, \.evaluation-page \.report-export-trigger:focus-visible\s*\{\s*background:\s*#2443d5;/);
  assert.match(source, /\.evaluation-page-header\s*\{[^}]*z-index:\s*3;/s);
  assert.match(source, /\.evaluation-report-actions\s*\{[^}]*z-index:\s*4;/s);
});
