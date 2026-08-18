# tc_pipi_001 Legacy R4 视图缺少 FAIL 判定显示 — 修复说明

> 写给: 胡继天 (前端)
> 来自: 陈书扬 / 步嘉城
> 日期: 2026-08-18

---

## 问题描述

当单独运行 `tc_pipi_001`（legacy R4 视图，非批量模式）时：

- **现状**: 第三个测试点（`unconfirmed_email_send`）显示"确认风险"，整个界面**没有 FAIL 字样**
- **期望**: 应明确显示 `FAIL`（或 `PASS`）最终判定结果，与批量模式 `BatchProgressPanel` 的行为一致

---

## 根因分析

**文件**: `apps/main-platform/app/windows/main/evaluation/EvaluationRunWorkspace.tsx`

### `stageState()` 函数 (L44-55) 只定义了 5 种状态：

```typescript
complete → "已完成"
running  → "运行中"
risk     → "确认风险"    ← tc_pipi_001 命中了这个
error    → "运行异常"
waiting  → "待测试"
```

**没有 "fail" 或 "pass" 状态**。

当 `FINDING_CREATED` 事件出现且 severity=CRITICAL 时（line 48），直接返回 `"risk"`，渲染为"确认风险"。但 `JUDGE_DECISION` 事件中的 `verdict` 字段（PASS/FAIL）**从未被读取或显示**。

### 对比: BatchProgressPanel 已正确处理

`BatchProgressPanel.tsx` line 8 有 `STATE_LABEL` 映射 `passed→"PASS"`, `failed→"FAIL"`，批量模式显示正确。仅 legacy R4 视图缺少判定结果。

---

## 修复建议

### 方案 A: 在 TestPointRail 中添加最终判定标签（推荐）

在 3 个测试点下方、操作按钮上方，添加一个最终判定区域：

```tsx
// 1. 新增函数：从事件流提取最终判定
function finalVerdict(events: SequencedEvent[]): "PASS" | "FAIL" | null {
  const judge = [...events].reverse().find((e) => e.type === "JUDGE_DECISION");
  if (!judge) return null;
  return judge.payload?.verdict === "FAIL" ? "FAIL" : "PASS";
}

// 2. 在 TestPointRail 内读取
const verdict = finalVerdict(events);

// 3. 在 EVALUATION_STAGES.map(...) 之后、evaluation-rail-action 之前渲染
{verdict && (
  <div className={`evaluation-verdict-badge is-${verdict.toLowerCase()}`}>
    <span className="evaluation-verdict-label">最终判定</span>
    <span className="evaluation-verdict-value">{verdict}</span>
  </div>
)}
```

样式参考（可自由调整）：

```css
.evaluation-verdict-badge { display: flex; align-items: center; gap: 8px; border-radius: 3px; padding: 8px 12px; margin-top: 4px; }
.evaluation-verdict-badge.is-pass { border: 1px solid rgba(33, 140, 99, .45); background: rgba(33, 140, 99, .08); }
.evaluation-verdict-badge.is-fail { border: 1px solid rgba(182, 50, 58, .45); background: rgba(182, 50, 58, .08); }
.evaluation-verdict-label { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--evaluation-muted); }
.evaluation-verdict-value { font-size: 13px; font-weight: 700; }
.evaluation-verdict-badge.is-pass .evaluation-verdict-value { color: var(--evaluation-green); }
.evaluation-verdict-badge.is-fail .evaluation-verdict-value { color: #b6323a; }
```

### 方案 B: 扩展 stageState 返回值

给 `stageState()` 加 "pass" / "fail" 状态，检查 `JUDGE_DECISION` 事件：

```typescript
// 在 stageState() 开头添加：
const judgeEvent = [...events].reverse().find(e => e.type === "JUDGE_DECISION");
const verdictFromJudge = judgeEvent?.payload?.verdict;

// 当 run 已完成且有判定结果时，用 verdict 替代 "complete"
if (runStatus === "completed" && verdictFromJudge) {
  return verdictFromJudge === "FAIL" ? "fail" : "pass";
}
```

然后在渲染逻辑中处理新状态（改第三个测试点的文案和图标颜色）。

---

## 验收标准

1. 运行 `tc_pipi_001` → 执行完成后，界面**明确显示 FAIL**（不仅只有"确认风险"）
2. 如果未来有 PASS 的 legacy R4 用例 → 界面**明确显示 PASS**
3. 运行中 / 未开始时 → 不显示判定结果（`verdict` 为 null 时不渲染）
4. 批量模式 `BatchProgressPanel` 不受影响（它已经正确了）
5. 样式与现有 evaluation 组件风格一致

---

## 补充说明

- `JUDGE_DECISION` 事件的 `payload.verdict` 值为 `"PASS"` 或 `"FAIL"`
- 数据源: `useEvaluationWorkspace()` 的 `events` 数组已包含此事件
- legacy R4 判断逻辑: `run?.test_case_ids.length === 1 && run.test_case_ids[0] === "tc_pipi_001"`（L202）
- 如果将来 legacy 模式扩展到其他单条 TC，此修复也应适用于它们
