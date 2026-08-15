# 前端交接文档 — D11-D13 后端变更

> 日期: 2026-08-14
> 作者: 陈书扬 (代行 Platform Line)
> 状态: **后端已完成，前端待对接**

---

## 1. 已完成的接口层变更 (你不需要改这些)

以下改动已由陈书扬完成并推送到 main (`c18cfd4`)：

```text
✅ backend-openapi.json: EventType 新增 TEST_COMPLETED
✅ backend-openapi.json: 新增 ReportSummary schema
✅ backend-openapi.json: EvaluationReport 新增 nullable summary 字段
✅ backend-api.d.ts: 同步上述 OpenAPI 变更
✅ evaluation-types.ts: eventText() 新增 TEST_COMPLETED 映射
✅ evaluation-types.ts: re-export ReportSummary 类型
```

**TypeScript 编译通过，零错误。前端外观无任何变化。**

---

## 2. 后端新增的能力 (你需要对接)

### 2.1 TEST_COMPLETED 事件 (L5)

后端在每条 TestCase 执行完成后发送 `TEST_COMPLETED` SSE 事件：

```json
{
  "event_type": "TEST_COMPLETED",
  "test_case_id": "tc_r4_e2e_001",
  "verdict": "FAIL",
  "evidence_count": 2,
  "rule_id": "FORBIDDEN_TOOL_CALL"
}
```

**你需要做的**:
- `EvaluationRunWorkspace.tsx`: `stageState()` 和 `eventKind()` 需要识别 `TEST_COMPLETED`
- `EvaluationWorkspaceProvider.tsx`: 批量执行时可能需要用 `TEST_COMPLETED` 来追踪多条 TestCase 的进度
- `evaluation-types.ts`: `eventStage()` 目前未映射 `TEST_COMPLETED` 到任何 stage（因为它不对应 R4 三阶段）

### 2.2 ReportSummary (L6)

`EvaluationReport` 新增 `summary` 字段 (nullable)：

```typescript
// 已在 backend-api.d.ts 中定义
ReportSummary: {
  total_tests: number;     // 总测试数
  passed: number;          // PASS 数
  failed: number;          // FAIL 数
  error: number;           // ERROR 数
  pass_rate: number;       // 通过率 0.0-1.0
  by_risk_pattern: Record<string, Record<string, number>>;
  // {"R1": {"total": 6, "passed": 4, "failed": 2, "error": 0}, ...}
  by_risk_type: Record<string, Record<string, number>>;
  // {"indirect_prompt_injection": {"total": 10, ...}, ...}
  by_severity: Record<string, Record<string, number>>;
  // {"HIGH": {"total": 8, "passed": 5, ...}, ...}
}
```

**你需要做的**:
- `EvaluationReportWorkspace.tsx`: 当 `report.summary` 存在时渲染统计面板
- `OverviewDashboard.tsx`: 可以从 `report.summary` 取真实数据替代 fixture

### 2.3 /test-cases API (D10)

```text
GET /test-cases
→ 返回所有可用 TestCase 列表 [{id, name, risk_type, severity, tags}]
```

**你需要做的**:
- 新增 BFF 路由 `app/api/test-cases/route.ts` 代理到后端
- TestCase 选择器组件从该 API 拉取数据

### 2.4 /agents API (已有，确认对接)

```text
POST /api/agents          → 注册 Agent (你已实现)
GET  /api/agents/{id}     → 获取 Agent Profile (你已实现)
```

### 2.5 sqlite_store limit 调整 (D12)

```text
事件查询上限从 100 提升到 1000。
前端无需改动，只是后端不再截断大量事件。
```

---

## 3. 变更单签字状态

| # | 变更 | 状态 |
|---|---|---|
| L5 | EventType 新增 TEST_COMPLETED | ✅ 三人签字完成 (胡继天授权代签) |
| L6 | EvaluationReport.summary | ✅ 三人签字完成 (胡继天授权代签) |
| L7 | id pattern 放宽 | ✅ 三人签字完成 (胡继天授权代签) |

签字文件: `docs/stage2_change_orders_l5_l6.md`

---

## 4. 建议的对接顺序

```text
① git pull 拉最新代码
② 确认 npm run build 无报错 (类型已同步，应该直接过)
③ 对接 TEST_COMPLETED 事件 (EvaluationRunWorkspace 进度展示)
④ 对接 ReportSummary (EvaluationReportWorkspace 统计面板)
⑤ 新增 /test-cases BFF 路由 + TestCase 选择器
⑥ 全链路串跑验证 (D14)
```

---

## 5. 当前测试状态

```text
后端: 224 pytest 全绿
前端: TypeScript 编译零错误
提交: c18cfd4 (main)
```
