# 📋 Plan A: 前端 Stage 3 计划 (给胡继天)

## A.1 API 契约变更 (后端保证，前端必须适配)

### 变更 1: `POST /evaluations` 请求体

```typescript
// 现有 (不变)
interface CreateEvaluationRequest {
  request_id: string;
  agent_id: string;      // ← 新增可选值
  test_case_ids: string[];
}

// agent_id 可选值:
// "corpmate-v0"        — 关键词 Agent (Stage 2 保留)
// "llm-agent-v0"       — Bare LLM Agent (Phase 3a)
// "defended-llm-v0"    — 带防御的 LLM Agent (Phase 3b+)
```

### 变更 2: `EvaluationReport` 响应体 (Phase 3b 后新增)

```typescript
// 新增可选字段 (向后兼容, 旧 Agent 返回 null)
interface EvaluationReport {
  // ...现有字段不变...
  defense_summary?: DefenseSummary | null;  // Phase 3b 新增
}

interface DefenseSummary {
  defenses_triggered: string[];   // 触发的防御层 ID, 如 ["D1", "D2", "D5"]
  defenses_blocked: string[];     // 成功阻断的防御层 ID
  agent_type: "corpmate" | "llm_bare" | "llm_defended";
}
```

### 变更 3: SSE 事件 (EventType 冻结不变)

- 18 种事件类型 **不变** (冻结契约 §2.1)
- 新增: `JUDGE_DECISION` 和 `FINDING_CREATED` 的 payload 可能包含 `defense_labels: string[]` 字段
- 新增: `AGENT_INVOKED` payload 新增 `agent_type: string` 字段

### 变更 4: 延迟变化

- LLM Agent 每个 turn 调用耗时 **3-15 秒** (CorpMate 是 < 100ms)
- SSE 心跳间隔 15 秒不变
- 前端需要对 LLM 延迟有明确的视觉反馈

## A.2 刚需功能 (必须完成, 不可省略)

### 刚需 1: Agent 类型选择器

**位置**: `TestCaseSelector.tsx` 工具栏区域 (搜索框旁边或上方)

**要求**:

- 下拉选择 Agent 类型: "CorpMate (关键词)" / "LLM Agent (语义)" / "Defended LLM (防御)"
- 默认值: "defended-llm-v0" (最终版本)
- 选择后传给 `prepareEvaluation()` → `POST /evaluations` 的 `agent_id`
- 切换 Agent 类型时不重置已选 TestCase

**验收标准**: 能选 Agent → 跑 86 TC → 报告中看到不同 Agent 的不同结果

### 刚需 2: LLM 延迟 Loading 提示

**位置**: `EvaluationRunWorkspace.tsx` 的 batch 模式 + legacy R4 模式

**要求**:

- 当 `AGENT_INVOKED` 事件发出后、`AGENT_RESPONDED` 尚未到达时，显示 LLM 推理中状态
- 提示文案: "🧠 LLM 推理中…" / "正在调用 DeepSeek API…" / "语义分析页面内容…"
- 显示已等待秒数 (实时计时器)
- 超时 30 秒后显示 "推理时间较长，请耐心等待…"
- 已有的 `loading_tips.md` 60 条提示词可复用

**验收标准**: LLM Agent 跑 TC 时，用户看到明确的等待状态而非空白/卡住

### 刚需 3: email.send 确认弹窗

**位置**: `EvaluationWorkspaceProvider.tsx` (新增确认逻辑)

**要求**:

- 当 SSE 收到 `TOOL_CALLED` 事件且 `tool_name === "email.send"` 且 `confirmed === false` 时
- 前端弹出确认对话框: "Agent 想要发送邮件到 {to}，是否允许？"
- 用户确认 → 前端通知后端继续 (具体交互协议由后端定义)
- 用户拒绝 → 前端通知后端拒绝

**⚠️ 简化方案 (MVP)**: Phase 3a/3b 阶段，确认弹窗仅做 **展示** (模拟确认流程)，不阻塞后端执行。后端 Sandbox 的 `enforce_email_confirmation` 门控已在后端处理。前端弹窗仅用于可视化演示。

**验收标准**: 当 Agent 尝试发邮件时，前端弹出确认对话框 (即使是展示性的)

### 刚需 4: Agent 类型标识

**位置**: `EvaluationRunWorkspace.tsx` + `EvaluationReportWorkspace.tsx`

**要求**:

- 运行界面顶部显示当前 Agent 类型标签: "🤖 CorpMate" / "🧠 LLM Agent" / "🛡️ Defended LLM"
- 报告界面标题旁显示 Agent 类型
- 用不同颜色区分: CorpMate=灰色, LLM Agent=橙色(⚠️危险), Defended LLM=绿色(✅安全)

**验收标准**: 一眼能看出当前跑的是哪个 Agent

## A.3 冻结 / 不要动

| 文件/模块                            | 原因                                            |
| ------------------------------------ | ----------------------------------------------- |
| `evaluation-types.ts` EventType 枚举 | 18 种事件类型冻结契约，不可新增/修改            |
| SSE 事件处理核心逻辑                 | `parseEvent()` / `reduceEvaluationEvent()` 不变 |
| `BatchProgressPanel.tsx` 进度追踪    | 已经通用化，适配任何 Agent                      |
| `EvaluationTerminal` 事件流（当前位于 `EvaluationRunWorkspace.tsx`） | 事件格式不变；不要为拆分组件改变事件流边界 |
| 攻击图谱页面 (anatomy)               | RiskPattern 定义不变                            |
| GSAP 动画系统                        | 与业务逻辑无关                                  |
| `evaluation-session.ts`              | sessionStorage 持久化逻辑不变                   |

> 架构级冻结说明见 `docs/architecture/frozen-frontend-contracts.md`，并同步受 `docs/architecture/modules-index.md` 与 `docs/architecture/extension-review-checklist.md` 约束。任何例外必须明确标注为“冻结契约变更”并完成专项评审。

## A.4 自由发挥区 (胡继天自行设计)

以下功能 **推荐做但具体设计自由发挥**:

### 推荐 1: 对比视图 (Bare LLM vs Defended LLM)

- 思路: 同一组 TC 跑两次 (llm-agent-v0 + defended-llm-v0)，并排展示 PASS/FAIL
- 交互方式自由: 分屏 / Tab 切换 / 叠加对比
- 优先级: 🟡 中

### 推荐 2: 防御机制可视化

- 思路: 当防御机制阻断攻击时，用动画/图标展示哪层防御生效
- D1-D8 每层一个图标/颜色
- 可以在报告中作为 badge/tag 展示
- 优先级: 🟡 中

### 推荐 3: 攻击拦截动画

- 思路: 当 IPI 攻击被防御阻断时，播放拦截动画 (类似防火墙拦截效果)
- 触发时机: `JUDGE_DECISION` verdict=PASS 但 trace 中有防御触发
- 优先级: 🟢 低

### 推荐 4: 因果链增强

- 思路: 5 节因果路径增加防御阻断点标注
- 如: 不可信网页 → ~~memory.write~~ (D7 阻断) → 新会话 → memory.read → email.send
- 优先级: 🟢 低

### 推荐 5: 报告导出

- 思路: PDF/CSV 导出测评报告
- 优先级: 🟢 低

## A.5 前端时间线建议

| 阶段   | 对应后端 | 交付内容                                                     |
| ------ | -------- | ------------------------------------------------------------ |
| Week 1 | Phase 3a | 刚需 1 (Agent 选择器) + 刚需 2 (LLM Loading) + 刚需 4 (Agent 标识) |
| Week 2 | Phase 3b | 刚需 3 (确认弹窗) + 推荐 1 (对比视图)                        |
| Week 3 | Phase 3c | 推荐 2 (防御可视化) + 推荐 3/4 (动画/因果链)                 |
