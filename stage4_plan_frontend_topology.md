# Frontend Line — AgentTopology 拓扑展示计划

> 编制日期: 2026-08-24
> 编制人: AI Coding Agent (陈书扬审阅)
> 定位: 在现有前端中增加 Agent 拓扑建模的展示能力
> 前置依赖: 后端 `AgentTopology` API + `graph_builder` 拓扑感知 (见 `stage4_plan_backend_topology.md`)
> 原则: **定最低标准，具体实现由前端开发者(胡继天)自行决定扩展方向**

---

## 0. 一句话定位

> **让用户在接入 Agent 时选择拓扑类型，在安全画像/攻击图谱中看到拓扑结构，在报告中看到 R5/R6 拓扑风险。**

---

## 1. 核心目标

| # | 目标 | 衡量标准 |
|---|------|---------|
| G1 | 拓扑选择器 | Agent 接入页能选择拓扑预设 (single / planner_executor / rag_agent) |
| G2 | 拓扑可视化 | 安全画像页展示拓扑节点结构图 |
| G3 | 攻击图谱扩展 | 攻击图谱页展示 R5/R6 风险路径 |
| G4 | 报告感知 | 测评报告页显示拓扑类型和拓扑风险覆盖 |
| G5 | 向后兼容 | 未选拓扑的 Agent 展示与 Stage 3 完全一致 |

---

## 2. 改动点 (最低标准)

### 2.1 Agent 接入页 — 拓扑选择器

**位置**: "初始接口" 工作区 (`agent` workspace)

**最低要求**:
- 在 Agent 注册表单中增加一个"被测对象结构"选择器
- 3 个选项 (单选):
  - 单 Agent 多工具 (single) — 默认
  - Planner-Executor (planner_executor)
  - RAG-Agent (rag_agent)
- 选择后调用 `POST /api/topology/{agent_id}` 保存拓扑配置

**展示建议** (由开发者决定):
```text
被测对象结构:
  ◉ 单 Agent 多工具       — 当前已有架构
  ○ Planner-Executor     — 规划-执行分离架构
  ○ RAG-Agent            — 检索增强生成架构
```

**交互**:
- 选择预设后，可以展示该预设的简要说明 (节点/边数)
- 选择结果传给后端保存
- 如果 Agent 已有拓扑配置，页面加载时回显

### 2.2 安全画像页 — 拓扑结构展示

**位置**: "安全画像" 工作区 (`profile` workspace)

**最低要求**:
- 如果当前 Agent 有非 single 的拓扑配置，在页面顶部或侧边展示拓扑结构
- 展示拓扑类型名称 (如 "Planner-Executor")
- 展示节点列表和各节点角色

**展示建议** (由开发者决定具体样式):
```text
拓扑结构: Planner-Executor

  ┌──────────┐     task_plan      ┌──────────┐
  │ Planner  │ ──────────────►   │ Executor │ ──► Tools
  │ (规划)    │   ⚠ 携带不可信内容   │ (执行)    │
  └──────────┘                    └──────────┘
```

或者简单的列表:
```text
拓扑: Planner-Executor
  • Planner — 任务规划 (接收外部输入)
  • Executor — 工具执行 (email.send, memory.write, ...)
  • 数据流: Planner → Executor (可能携带不可信内容)
```

**数据来源**: `GET /api/topology/{agent_id}`

### 2.3 攻击图谱页 — R5/R6 路径展示

**位置**: "攻击图谱" 工作区 (`anatomy` workspace)

**最低要求**:
- 在攻击图谱 SVG 中，新增的节点类型要有展示:
  - `KNOWLEDGE_BASE` 节点: 用不同形状/颜色 (如数据库图标、紫色)
  - `role: "planner"` / `role: "executor"` 的 AGENT 节点: 用标签或颜色区分
- R5 / R6 风险路径需要在路径列表中可见
- 风险路径卡片中显示 R5/R6 的名称和描述

**展示建议**:
```text
新增节点样式:
  KNOWLEDGE_BASE → 圆柱形 (数据库图标) + 紫色
  planner AGENT  → 蓝色方框 + "规划" 标签
  executor AGENT → 绿色方框 + "执行" 标签

新增风险路径:
  R5: 计划污染  HIGH  → 恶意网页 → Planner → Executor → email.send
  R6: RAG投毒  HIGH  → 外部文档 → 知识库 → Retriever → Agent → email.send
```

### 2.4 测评运行页 — 风险筛选扩展

**位置**: "测评运行" 工作区 (`run` workspace)

**最低要求**:
- 风险模式筛选器从 R1-R4 扩展为 R1-R6
- 新增项显示:
  - R5: 计划污染 (Planner-Executor)
  - R6: RAG 上下文投毒 (RAG-Agent)

**展示建议**:
```text
风险模式筛选:
  ☑ R1-R4  基础 Agent 风险
  ☑ R5     计划污染 (拓扑风险)
  ☑ R6     RAG 上下文投毒 (拓扑风险)
```

### 2.5 测评报告页 — 拓扑风险覆盖

**位置**: "测评报告" 工作区 (`report` workspace)

**最低要求**:
- 报告中显示被测 Agent 的拓扑类型
- 风险发现中 R5/R6 的 finding 正常展示
- 评分概览中能看到 R5/R6 的覆盖情况

**展示建议**:
```text
被测对象: Defended LLM Agent v0
拓扑结构: Planner-Executor    ← 新增

风险发现:
  R5 · HIGH · 计划污染: Planner 被网页隐藏指令污染...   ← 新增
  R1 · HIGH · 间接提示注入: ...
  ...

风险覆盖:
  R1-R4 基础风险: 4/4 已测试
  R5-R6 拓扑风险: 2/2 已测试      ← 新增
```

---

## 3. BFF 路由

### 3.1 新增路由

| 方法 | 路径 | 上游 | 说明 |
|------|------|------|------|
| `GET` | `/api/topology/presets` | `GET /topology/presets` | 获取预设列表 |
| `GET` | `/api/topology/[agentId]` | `GET /topology/{agent_id}` | 获取 Agent 拓扑 |
| `POST` | `/api/topology/[agentId]` | `POST /topology/{agent_id}` | 设置 Agent 拓扑 |

### 3.2 文件结构

```text
app/api/topology/
├── presets/
│   └── route.ts              # GET /api/topology/presets
└── [agentId]/
    └── route.ts              # GET + POST /api/topology/{agentId}
```

---

## 4. TypeScript 类型 (临时)

```typescript
// 放在合适的位置，后端 OpenAPI 更新后切换

interface TopologyNode {
  id: string;
  role: string;            // "PLANNER" | "EXECUTOR" | "RETRIEVER" | "KNOWLEDGE_BASE" | "AGENT"
  trust_boundary: string;  // "internal" | "external"
  tools: string[];
}

interface TopologyEdge {
  from_node: string;
  to_node: string;
  channel: string;
  carries_untrusted_content: boolean;
}

interface AgentTopology {
  agent_id: string;
  topology_type: string;   // "single" | "planner_executor" | "rag_agent"
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}
```

**命名**: 字段名保持 `snake_case` (与 wire format 一致)。

---

## 5. 可修改的文件范围

```text
✓ apps/main-platform/app/api/topology/          ← 新增 BFF 路由
✓ apps/main-platform/app/windows/main/agent/    ← Agent 接入页 (加拓扑选择器)
✓ apps/main-platform/app/windows/main/profile/  ← 安全画像页 (加拓扑展示)
✓ apps/main-platform/app/windows/main/anatomy/  ← 攻击图谱页 (加 R5/R6 + 新节点)
✓ apps/main-platform/app/windows/main/run/      ← 测评运行页 (加 R5/R6 筛选)
✓ apps/main-platform/app/windows/main/report/   ← 测评报告页 (加拓扑信息)

✗ 不得修改后端代码
✗ 不得修改红队演练工作区 (Stage 3)
✗ 不得修改 shared/contracts/
✗ 不得引入第三方图表库
```

---

## 6. 工作量估算

| 步骤 | 工作量 | 说明 |
|------|--------|------|
| BFF 路由 (3 条) | 0.25 天 | 薄代理 |
| 拓扑选择器 (接入页) | 0.5 天 | 单选 + API 调用 |
| 拓扑可视化 (画像页) | 0.5~1 天 | SVG 或 HTML，复杂度由开发者决定 |
| 攻击图谱扩展 | 0.5~1 天 | 新节点样式 + R5/R6 路径，复杂度由开发者决定 |
| 运行页 + 报告页 | 0.25 天 | 加 R5/R6 文案 |
| 联调 | 0.5 天 | 前后端对接 |
| **总计** | **2.5~3.5 天** | |

---

## 7. 扩展方向 (由前端开发者自行决定)

以下是可选的增强方向，不强制，优先级由开发者判断:

```text
① 拓扑编辑器: 允许用户自定义节点和边 (高级)
② 拓扑对比: 不同拓扑下的安全评分对比
③ 动画: 拓扑结构图的数据流动画 (GSAP)
④ 交互式拓扑图: 点击节点查看详情
⑤ 拓扑预设卡片: 每种拓扑的示意图和说明
```

---

## 8. 禁止事项

```text
① 不得修改现有 7 个工作区的核心逻辑 (只做增量添加)
② 不得引入第三方图表/图形库 (D3/ECharts/Recharts/vis.js 等)
③ 不得修改 shared/contracts/
④ 不得修改后端代码
⑤ 不得将字段名改为 camelCase
```

---

## 9. Definition of Done

```text
① Agent 接入页有拓扑选择器，3 个预设可选
② 选择拓扑后 API 调用成功，配置被保存
③ 安全画像页展示非 single 拓扑的结构信息
④ 攻击图谱页展示 KNOWLEDGE_BASE 新节点类型
⑤ 攻击图谱页展示 R5/R6 风险路径
⑥ 测评运行页风险筛选包含 R5/R6
⑦ 测评报告页显示拓扑类型
⑧ single 拓扑下所有页面与 Stage 3 一致
⑨ 全流程不刷新页面
```

---

*本计划为最低标准。具体视觉设计和交互细节由前端开发者(胡继天)自行决定。*
