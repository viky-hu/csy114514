# Frozen Frontend Contracts

> 本文档是前端 Evaluation / Anatomy 相关模块的冻结边界。任何新增功能、重构或 AI 生成代码在修改下列文件前，必须先获得明确的契约变更批准；默认行为是保持不变。

## A.3 冻结 / 不要动

| 文件/模块 | 冻结原因 | 允许的变更 |
| --- | --- | --- |
| `apps/main-platform/app/windows/main/evaluation/evaluation-types.ts` 的 `EventType` 类型（来源为生成的 `app/lib/contracts/backend-api.d.ts`） | 18 种事件类型是跨前后端的冻结事件契约，不可新增、删除、重命名或修改既有值 | 仅可在后端契约正式变更、OpenAPI/类型同步并完成专项评审后修改；不得在前端另建平行枚举 |
| SSE 事件处理核心逻辑：`parseEvent()` / `reduceEvaluationEvent()` | 负责事件解析、排序、去重和状态归约；改变会破坏回放、进度和报告一致性 | 新 UI 只能消费现有归约结果，不得复制、绕过或改写核心逻辑 |
| `apps/main-platform/app/windows/main/evaluation/BatchProgressPanel.tsx` | 进度追踪已通用化，适配任何 Agent 和批量 TestCase | 只允许不改变事件来源、状态语义和选中项映射的展示性扩展 |
| `EvaluationTerminal` 事件流 | 事件格式和脱敏展示边界不变 | 当前实现位于 `apps/main-platform/app/windows/main/evaluation/EvaluationRunWorkspace.tsx`；不要为拆分组件而改变事件格式或流生命周期 |
| 攻击图谱页面 `apps/main-platform/app/windows/main/anatomy/**` | `RiskPattern` 定义、风险路径语义和验证状态来源不变 | 新数据源必须适配现有 view model；不得新增或重定义 RiskPattern |
| GSAP 动画系统 | 动画与业务事件、判定和持久化无关 | 动画调整不得改变事件、状态归约、判定结果或 session 行为 |
| `apps/main-platform/app/windows/main/evaluation/evaluation-session.ts` | `sessionStorage` 持久化、恢复和清理逻辑是运行状态边界 | 不得改变存储键、快照语义、恢复条件或清理时机；新字段须先完成契约评审 |

### 固定 EventType 值

`RUN_STARTED`, `ANATOMY_READY`, `RISK_PATH_FOUND`, `TEST_STARTED`, `SEED_SELECTED`, `MUTATION_CREATED`, `TOOL_CALLED`, `MEMORY_WRITTEN`, `JUDGE_DECISION`, `FINDING_CREATED`, `RUN_FINISHED`, `PREFLIGHT_COMPLETED`, `PREFLIGHT_FAILED`, `AGENT_INVOKED`, `AGENT_RESPONDED`, `TOOL_RESULT`, `RUN_FAILED`, `TEST_COMPLETED`。

以上列表必须与后端 OpenAPI 和生成的 `backend-api.d.ts` 一致；前端展示逻辑只能消费这些值。

## AI / 开发者修改前检查

1. 先阅读本文档、`docs/architecture/modules-index.md` 和 `docs/architecture/extension-review-checklist.md`。
2. 若需求只涉及展示、筛选或布局，应通过现有状态和 view model 扩展，不得修改冻结模块的事件、枚举、持久化或 RiskPattern 语义。
3. 若确需改变冻结契约，必须同时更新后端/生成类型（如适用）、测试、模块索引和扩展审查清单，并在变更说明中明确写出“冻结契约变更”。未满足这些条件时，拒绝该修改。

## 权威来源与交叉引用

- Stage 3 原始需求：`Stage3.md` 的 A.3。
- 模块边界索引：`docs/architecture/modules-index.md` 的“冻结前端契约（A.3）”节。
- 变更审查入口：`docs/architecture/extension-review-checklist.md` 的“Frozen Frontend Contracts (A.3)”节。
