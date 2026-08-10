# Frontend & Experience Line — Stage 2

## 组员 B / Frontend Owner Stage 2 执行计划

> 本文是 Stage 2 (D8-D14) 的 Frontend Line 执行规范。
> Stage 1 已完成 M1 验收 (前端全功能骨架 + 真实 API 对接)，本计划聚焦 Sprint 2 前端侧任务。

---

# 1. Stage 2 角色聚焦

Stage 2 本线核心职责：

> 从"单 TestCase 展示"升级到"多 TestCase 选择、多轮对话展示、批量进度、统计报告"。

Stage 1 产出的是 **完整前端骨架** (Login, Overview, Profile, Anatomy, Evaluation Run, Report)。

Stage 2 产出的是 **测评工作流 UI** (选择 TestCase → 批量执行 → 多轮对话 → 统计报告)。

本线 Stage 2 不负责：

```text
TestCase 内容设计           → Security Line
Runner/Sandbox/Judge 实现   → Platform Line
安全规则定义                → Security Line
```

---

# 2. Stage 1 前端现状 (必须了解)

已有完整组件：

```text
LoginIntroWindow              登录 + Agent 接入
OverviewDashboard             总览 (fixture 数据)
SecurityProfileGraph          安全画像 (fixture 数据)
AttackGraphWorkspace          攻击图谱 (真实 API + fixture fallback)
EvaluationRunWorkspace        测评运行 (SSE streaming)
EvaluationReportWorkspace     测评报告 (findings + evidence)
EvaluationWorkspaceProvider   完整生命周期 context
```

已有 BFF 路由：

```text
GET  /api/health
GET  /api/agents/[agentId]/graph
POST /api/evaluations
GET  /api/evaluations/[evaluationId]
POST /api/evaluations/[evaluationId]/start
GET  /api/evaluations/[evaluationId]/events     (SSE)
GET  /api/evaluations/[evaluationId]/report
GET  /api/evaluations/[evaluationId]/trace
```

**Stage 2 关键限制**:

```text
① 当前硬编码 test_case_ids = ["tc_pipi_001"]
② Overview 和 Profile 页面 100% fixture 数据
③ 无 TestCase 选择器
④ 无批量进度展示
⑤ 无统计图表
```

---

# 3. 与其他两线的 Stage 2 接口契约

## 3.1 Platform → Frontend (本线从 Platform 获取的)

### ① TestCase 列表 API (D10 交付)

```text
GET /api/test-cases
Response: TestCaseSummary[]

TestCaseSummary:
    id: string                   # "tc_r4_e2e_001"
    name: string                 # "R4 持久化 IPI - 恶意网页注入"
    risk_type: string            # "persistent_indirect_prompt_injection"
    severity: string             # "CRITICAL"
    target_risk_pattern: string  # "R4"
    turn_count: number           # 2 (inputs 数组长度)
    description: string          # 人可读描述
```

**本线责任**: 
- 新增 BFF 路由 `/api/test-cases/route.ts`
- 构建 TestCase 选择器组件
- 按 risk_pattern / severity 筛选

**对接节点**: D8 与 Platform 确认字段，D10 联调。

---

### ② 批量 Evaluation API (D10-D12 逐步交付)

```text
POST /api/evaluations
Request:
{
    request_id: string,
    agent_id: string,
    test_case_ids: string[]     # Stage 2: 支持多条!
}
```

**与 Stage 1 区别**: 不再限制为单条。

**对接节点**: D10 确认接口可用，D12 批量联调。

---

### ③ SSE 事件增强 (D12 交付)

批量执行时，SSE 事件新增字段：

```text
TEST_STARTED:
    test_case_id: string       # 新增
    turn_index: number         # 新增: 当前轮次
    total_turns: number        # 新增: 总轮数

TEST_COMPLETED:
    test_case_id: string       # 新增
    verdict: "PASS" | "FAIL" | "ERROR"
    ...existing fields...
```

**本线责任**:
- Event State Engine 解析新增字段
- 按 test_case_id 分组展示进度
- 多轮对话按 turn_index 排列

**对接节点**: D10 与 Platform 确认新增字段，D12 联调。

---

### ④ Report Summary (D13 交付)

```text
EvaluationReport.summary:
    total_tests: number
    passed: number
    failed: number
    error: number
    pass_rate: number
    by_risk_pattern: Record<string, {total, passed, failed}>
    by_risk_type: Record<string, {total, passed, failed}>
    by_severity: Record<string, {total, passed, failed}>
```

**本线责任**:
- 统计图表组件 (柱状图/饼图)
- 按维度切换展示

**对接节点**: D11 与 Platform 确认 summary 结构，D13 联调。

---

## 3.2 Security → Frontend (本线从 Security 获取的)

### ① TestCaseSummary 字段确认 (D8)

Security 定义 TestCase 的安全语义字段，Frontend 消费展示。

**对接节点**: D8 三方确认 TestCaseSummary 字段冻结。

---

### ② JudgeResult + Evidence 结构 (D11)

```text
JudgeResult:
    verdict: "PASS" | "FAIL" | "ERROR"
    rule_id: string
    evidence: EvidenceItem[]
    reasoning: string
    confidence: number

EvidenceItem:
    event_id: string
    description: string
    severity: string
```

**对接节点**: D11 与 Security 确认结构。

---

## 3.3 Frontend → Platform/Security (本线提供给其他人的)

前端不向其他线提供数据结构。

但前端是最终验收的"眼睛"：

```text
前端展示正确 = 后端数据正确
前端展示异常 = 后端数据有问题 → 通知对应线修复
```

---

# 4. Day 0 任务 (D8 上午)

## Task F2-0: 类型适配 + 选择器骨架

上午参与变更单签字后：

```text
① 等 Platform 更新 OpenAPI schema
② 重新生成 backend-api.d.ts
③ 确认 TestCase 类型新增 inputs 字段
④ TestCase 选择器组件骨架 (可先用 mock 数据)
```

**日终交付物**:
- OpenAPI types 更新
- TestCase 选择器组件骨架 (mock 数据可渲染)

---

# 5. 每日任务 (D8-D14)

## D8 — TestCase 选择器

### 组件设计

```text
TestCaseSelector/
├── TestCaseSelector.tsx          # 主组件
├── TestCaseFilter.tsx            # 按 risk_pattern/severity 筛选
├── TestCaseCard.tsx              # 单条 TestCase 卡片
└── test-case-types.ts            # 本地 view model types
```

选择器交互：

```text
① 左侧: TestCase 列表 (按 risk_pattern 分组)
② 每条显示: id, name, risk_type, severity badge, turn_count
③ 支持多选 (checkbox)
④ 底部: 已选 N 条, "开始测评" 按钮
⑤ 点击 "开始测评" → POST /api/evaluations
```

**日终检查**:
- 选择器骨架可用 (mock 数据)
- 与 Security/Platform 确认 TestCaseSummary 字段

---

## D9 — 多轮对话展示组件

### 组件设计

```text
MultiTurnDialog/
├── MultiTurnDialog.tsx           # 多轮对话主组件
├── TurnBubble.tsx                # 单轮气泡 (用户输入 + Agent 响应)
├── TurnTimeline.tsx              # 轮次时间轴
└── EnvDeltaIndicator.tsx         # env_delta 标注
```

展示内容：

```text
每轮显示:
    用户输入 (ScenarioTurn.input)
    env_delta 标注 (如有: "📄 新增网页: evil.com")
    Agent 响应
    Tool Calls (如有)
    Memory 操作 (如有)
```

### Event State Engine 更新

```text
AGENT_INPUT 事件 → 新增一轮对话气泡
TOOL_CALLED 事件 → 在当前轮次下显示 tool call
MEMORY_WRITTEN 事件 → 在当前轮次下显示 memory 操作
TEST_COMPLETED 事件 → 标记本轮 verdict (PASS/FAIL)
```

**日终检查**:
- 多轮对话组件骨架可用
- Event State Engine 支持 test_case_id + turn_index

---

## D10 — Evaluation Run 多 TestCase 进度

### 进度组件

```text
BatchProgressPanel/
├── BatchProgressPanel.tsx        # 批量进度主组件
├── TestCaseProgressItem.tsx      # 单条 TestCase 进度
└── batch-progress-types.ts       # 状态类型
```

每条 TestCase 状态：

```text
pending    → ⏳ 等待中 (灰色)
running    → 🔄 执行中 (蓝色动画)
passed     → ✅ 通过 (绿色)
failed     → ❌ 失败 (红色)
error      → ⚠️ 错误 (黄色)
```

整体进度：

```text
顶部: 进度条 (已完成/总数) + 通过率
中间: TestCase 列表 (按状态排列)
底部: 当前正在执行的 TestCase 的多轮对话展示
```

### BFF 路由

新增 `/api/test-cases/route.ts`:

```typescript
// GET /api/test-cases → 转发到后端 GET /test-cases
export async function GET() {
    const url = buildAgentEvalBackendUrl("/test-cases");
    const upstream = await fetch(url);
    return forwardJsonResponse(upstream);
}
```

**对接节点**: D10 与 Platform 联调 TestCase 列表 API + 多 TestCase 执行。

**日终检查**:
- TestCase 列表 API 可用 (真实后端数据)
- 批量进度面板骨架可用
- 能选择不同 TestCase 并分别执行

---

## D11 — Report 统计图表

### 图表组件

```text
StatisticsCharts/
├── StatisticsCharts.tsx           # 统计图表主组件
├── RiskPatternChart.tsx           # 按 RiskPattern 的柱状图
├── SeverityChart.tsx              # 按 Severity 的饼图/环图
├── PassRateTile.tsx               # 通过率数字卡片
└── statistics-types.ts
```

### 图表内容

```text
① 总通过率大数字 (如 "73.2%")
② 按 RiskPattern 分组柱状图:
    R1: 6/8 passed  ████████░░
    R2: 3/4 passed  ███████░░░
    R3: 2/3 passed  ██████░░░░
    R4: 4/6 passed  ███████░░░
③ 按 Severity 环图:
    CRITICAL: 2 failed / 4 passed
    HIGH: 5 failed / 8 passed
④ 按 risk_type 明细表
```

**对接节点**: D11 与 Platform 确认 summary 结构，与 Security 确认 JudgeResult 结构。

**日终检查**:
- 统计图表骨架可用 (mock 数据)
- summary + JudgeResult 结构冻结

---

## D12 — Overview Dashboard 切真实 API

### 当前状态

Overview Dashboard 100% fixture 数据：

```text
overview-data.ts → createOverviewViewModel() → 全部读 fixture JSON
```

### 改造目标

```text
① Agent 信息: GET /api/agents/{agentId} → 真实数据
② 攻击图谱: GET /api/agents/{agentId}/graph → 已有真实 API (Stage 1)
③ 最近测评: GET /api/evaluations → 最近一次测评摘要
④ 保留 fixture fallback (API 不可用时)
```

**对接节点**: D12 与 Platform 确认可用的 API 端点。

**日终检查**:
- Overview Dashboard 至少 2 个数据源切到真实 API
- 批量执行 UI 联调完成

---

## D13 — UI 联调 + 交互打磨

全天联调：

```text
① TestCase 选择器 → POST /evaluations → 批量执行 → SSE 事件 → 进度更新
② 点击 TestCase → 展开多轮对话 → 查看 Evidence
③ 报告页面 → 统计图表 → 从真实 summary 数据渲染
④ Overview → 真实数据展示
⑤ 全流程顺畅度检查
⑥ 交互细节打磨 (loading, empty state, error state)
```

**日终检查**:
- 全流程 (选择 → 执行 → 报告) 顺畅无阻塞
- 错误状态有合理处理

---

## D14 — 全链路串跑 + Bug 修复

全天串跑：

```text
① 启动前端 dev server
② 从 TestCase 选择器开始
③ 选择 ≥10 条 TestCase
④ 点击 "开始测评"
⑤ 观察批量进度更新
⑥ 查看多轮对话展示
⑦ 查看统计报告
⑧ 检查 Evidence 详情
⑨ 修复发现的问题
⑩ 更新 log.md
```

**日终检查**: **M2 Frontend Gate 通过**

---

# 6. M2 Frontend Gate (D14)

必须满足：

```text
① TestCase 选择器: 能从后端加载列表, 多选提交
② 批量进度: 多条 TestCase 执行过程实时展示
③ 多轮对话: 每条 TestCase 的 turn-by-turn 展示
④ 统计报告: summary 数据的图表展示
⑤ Evidence 详情: 每条 FAIL 的可解释证据
⑥ SSE 事件: 正确消费 test_case_id + turn_index
⑦ 全流程不刷新页面: 选择 → 执行 → 报告
⑧ 错误处理: 后端不可用时有合理 fallback
```

本线验收核心：

> **用户从选择 TestCase 到查看报告，全程流畅，数据真实。**

---

# 7. 与 Platform Line 的对接时间表

| 日期 | 对接内容 | 双方职责 | 产出 |
|------|---------|---------|------|
| D8 | OpenAPI schema 更新 | Platform 更新, Frontend 重新生成 | types 同步 |
| D10 | **TestCase 列表 API** | Platform 提供, Frontend 调用 | 选择器真实数据 |
| D10 | SSE 新增字段 | Platform 定义, Frontend 消费 | 字段冻结 |
| D11 | Report summary 结构 | Platform 定义, Frontend 消费 | 结构冻结 |
| D12 | **批量 SSE 事件联调** | Platform 发事件, Frontend 展示 | 进度条真实数据 |
| D12 | Overview API 联调 | Platform 提供数据, Frontend 展示 | 真实总览 |
| D13 | 统计 API 联调 | Platform 提供 summary, Frontend 渲染 | 图表真实数据 |
| D14 | 全流程串跑 | 双方共同验证 | M2 通过 |

---

# 8. 与 Security Line 的对接时间表

| 日期 | 对接内容 | 双方职责 | 产出 |
|------|---------|---------|------|
| D8 | TestCaseSummary 字段确认 | Security 定义, Frontend 确认 | 字段冻结 |
| D10 | TestCase 数据验证 | Security 提供数据, Frontend 确认可渲染 | 数据正确 |
| D11 | JudgeResult + Evidence 结构 | Security 定义, Frontend 确认 | 结构冻结 |
| D12 | 批量结果展示验证 | Security 确认结果准确, Frontend 展示 | 报告正确 |
| D14 | 全流程演示 | 双方共同验证 | 端到端通过 |

---

# 9. Stage 2 新增 BFF 路由

```text
GET  /api/test-cases                           ← TestCase 列表 (新增)
GET  /api/test-cases/[testCaseId]              ← TestCase 详情 (新增, 可选)
```

现有路由不变，但后端行为增强：

```text
POST /api/evaluations                          ← test_case_ids 支持多条
GET  /api/evaluations/[id]/events              ← SSE 新增 test_case_id 字段
GET  /api/evaluations/[id]/report              ← 新增 summary 字段
```

---

# 10. Stage 2 可修改的文件范围

本线可以修改：

```text
apps/main-platform/app/                ← Next.js 页面和组件
apps/main-platform/app/api/            ← BFF 路由 (新增)
apps/main-platform/app/styles/         ← 样式
apps/main-platform/app/lib/            ← 工具函数
apps/main-platform/app/windows/        ← 窗口组件
```

修改前必须同步：

```text
Backend API schema                     ← 通知步嘉城 (影响 OpenAPI)
Security 语义字段                       ← 通知陈书扬 (影响展示准确性)
```

---

# 11. 禁止事项

```text
① 不得私自修改 Contract 字段 (发现不一致通知 Platform 修正)
② 不得在前端定义与 Contract 平行的类型 (用 OpenAPI 生成的类型)
③ 不得修改后端代码
④ 不得修改 Security 资产文件
⑤ 不得为了快速展示硬编码假数据 (fixture 只能作为 fallback)
⑥ 不得在 D14 前做 Stage 3 功能 (Mutation 可视化, Attack Animation)
⑦ 不得大重构 Stage 1 的视觉系统
⑧ 不得删除 SSE 重连机制
```

---

# 12. 前端数据流总览 (Stage 2)

```text
TestCase 选择器
    │
    │ 用户选择 N 条 TestCase
    ▼
POST /api/evaluations
    │
    │ 返回 EvaluationRun (id)
    ▼
POST /api/evaluations/{id}/start
    │
    │ 开始执行
    ▼
EventSource: /api/evaluations/{id}/events
    │
    ├── TEST_STARTED (test_case_id, turn_index)
    │       → 进度面板: 标记 "执行中"
    │       → 多轮对话: 新建气泡
    │
    ├── TOOL_CALLED
    │       → 多轮对话: 当前轮次下显示 tool call
    │
    ├── MEMORY_WRITTEN
    │       → 多轮对话: 当前轮次下显示 memory 操作
    │
    ├── JUDGE_DECISION
    │       → 多轮对话: 标记 verdict
    │
    ├── TEST_COMPLETED (test_case_id, verdict)
    │       → 进度面板: 标记 passed/failed
    │
    └── RUN_FINISHED
            → 自动加载报告
            ▼
GET /api/evaluations/{id}/report
    │
    ├── summary → 统计图表
    ├── findings → Finding 列表
    └── evidence → Evidence 详情
```

---

# 13. Definition of Done (Stage 2)

完成意味着：

```text
TestCase 可以被选择
测评可以被批量执行
执行过程可以实时观察
多轮对话可以逐轮展示
统计报告可以按维度分析
Evidence 可以追溯到具体 Event
全流程不刷新、不手动、不 Mock
```

而不是：

> "页面能展示 tc_pipi_001 的结果。"
