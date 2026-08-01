# Agent 安全评估平台前端

本仓库是全智赛小组系统赛项目的前端工作区。主前端位于 `apps/main-platform`，目标不是做展示型 eval 网站，而是做一个面向评估操作员和比赛评委的 Agent 安全评估工作台。

核心闭环：

```text
接入 Agent → 生成安全画像 → 识别攻击图 → 编排测试 → 运行评估 → 查看证据报告
```

一句话概括：

> 把 Agent 的结构、攻击入口、攻击链路、测试场景、判定规则和评估结果转化为可观察、可解释、可复现、可修复的安全评估界面。

## 需求来源

根目录 `shared/` 是前端功能规划的主要需求来源，也是 README 里的默认引用位置。`csy——全智赛/shared` 与根目录 `shared` 当前内容一致，可视为同一组契约副本。

冻结契约位于：

- `shared/contracts/SECURITY_CONTRACTS.md`
- `shared/contracts/risk_pattern.schema.json`
- `shared/contracts/attack_seed.schema.json`
- `shared/contracts/test_case.schema.json`

核心对象关系：

| 对象 | 回答的问题 | 前端模块 |
| --- | --- | --- |
| `RiskPattern` | 什么结构值得攻击 | 风险模式库、攻击路径模板、风险等级与判定规则说明 |
| `AttackSeed` | 攻击从哪里开始 | 攻击载荷库、投放方式、目标工具、难度与标签 |
| `TestCase` | 如何执行和判定一次测试 | 测试用例工作台、沙箱初始状态、禁止动作、PASS/FAIL 条件 |
| `AgentManifest` | 被测 Agent 声明了什么能力 | Agent 接入、画像确认、权限编辑 |
| `AgentProfile` | Anatomy 后的安全资产画像 | 安全画像、资产风险摘要 |
| `AttackGraph` | Agent 攻击面如何连接 | 攻击图谱、风险路径高亮 |
| `ExecutionEvent` | 评估过程发生了什么 | 运行时间线、Trace/SSE 预留 |
| `RiskFinding` / `EvaluationReport` | 风险结论和证据是什么 | 报告证据、复盘与导出 |

任何页面、类型、筛选项和接口字段都必须围绕这些契约展开，不能在前端自造平行命名。

## 主页面工作流

当前第一页和第二页已经承担入口职责。第二页右上角的确认入口进入主页面后，主页面应按以下顺序组织评估流程：

```text
第二页确认接入
→ 工作台总览
→ Agent 画像确认
→ Anatomy 攻击图
→ 测试用例工作台
→ 评估运行时间线
→ 风险报告与证据复盘
```

主页面的第一目标是让评估操作员可以从一个 Agent 出发，完成一次可解释的安全评估，而不是只浏览静态资料。

## 导航栏规划

主页面导航应覆盖完整评估链路：

| 导航项 | 作用 |
| --- | --- |
| 总览 | 当前 Agent、最高风险、总体分数、命中模式、下一步动作 |
| Agent 接入 | API 接入参数、Manifest 草稿、接入状态 |
| 安全画像 | 能力、数据源、记忆、工具权限、安全资产标注 |
| 攻击图谱 | `AttackGraph` 节点、边、风险路径和安全标签 |
| 安全资产库 | `RiskPattern`、`AttackSeed`、`TestCase` 三类安全资产 |
| 测试工作台 | 测试选择、场景查看、输入、禁止动作、判定条件 |
| 运行时间线 | `ExecutionEvent`、工具调用、记忆读写、判定事件 |
| 报告证据 | `EvaluationReport`、`RiskFinding`、`JudgeResult`、Evidence |
| 契约状态 | 冻结枚举、API 状态、fixture/contract 来源和字段守卫 |

## 功能栏规划

主页面顶部或侧向功能栏应服务当前任务上下文，优先放置这些操作：

- 当前 Agent 选择：切换或查看当前 `agent_id`。
- 数据源模式：在 Mock/Fixture 与真实 API 数据之间切换。
- 健康状态：读取 `GET /health`，展示后端可用性。
- 开始分析：从已确认 Manifest 触发画像和攻击图生成。
- 启动评估：基于选中的 `TestCase` 创建 Evaluation。
- 重置沙箱：为后续 Runner/Sandbox 接入预留。
- 导出报告：导出当前 `EvaluationReport`。
- 风险筛选：按 `risk_type`、`severity`、`risk_pattern_id` 过滤。
- 节点标签筛选：按 `UNTRUSTED`、`TRUSTED`、`SENSITIVE`、`DANGEROUS`、`PERSISTENT` 过滤。
- 事件类型筛选：按 `ExecutionEvent.type` 过滤运行时间线。
- 视图切换：在 JSON、图谱、证据、时间线视图间切换。

## 功能模块规划

| 模块 | 模块目标 | 输入契约/API | 核心功能 | 当前支撑状态 |
| --- | --- | --- | --- | --- |
| 总览 Dashboard | 让评估者快速判断当前 Agent 风险状态 | `AgentProfile`、`AttackGraph.risk_path_ids`、`EvaluationReport` | 展示当前 Agent、最高严重等级、总体分数、命中的 `RiskPattern`、最近 Evaluation 和下一步动作 | 可由 fixture 和 mock report 支撑 |
| Agent 接入 | 承接第二页接入草稿，形成可提交的 Agent 声明 | `AgentManifest`、后续 `POST /agents` | API Endpoint、Method、Headers、Request Template、Response Path、Manifest JSON 预览 | 已有 `AgentConnectDraft` 本地草稿，尚未提交后端 |
| 安全画像 Profile Confirmation | 让用户确认 Agent 能力与权限边界 | `AgentManifest`、`AgentProfile` | 展示 `capabilities`、`data_sources`、`memory`、`tool_permissions`，确认 `ALLOW` / `CONFIRM` / `DENY` | 后端 mock `POST /agents`、`GET /agents/{id}` 可支撑 |
| 攻击图谱 Anatomy Graph | 把 Agent 攻击面转化为可解释图谱 | `AttackGraph.nodes`、`AttackGraph.edges`、`risk_path_ids` | 展示节点、边、安全标签、命中风险模式；重点高亮 R4 链路 `Web → Agent → Memory → Agent → Email` | 后端 mock `GET /agents/{id}/graph` 可支撑 |
| 安全资产库 | 把安全契约变成可查询资产 | `RiskPattern`、`AttackSeed`、`TestCase` | 三类资产分区展示；按 `risk_type`、`severity`、`attack_type`、`delivery_method`、`judge_policy`、`tags` 过滤 | 契约和 schema 已支撑，资产 JSON 需要后续补齐 |
| 测试工作台 | 组织一次可执行安全测试 | `TestCase`、`AttackSeed` | 查看场景、初始沙箱状态、用户输入、`expected_behavior`、`forbidden_actions`、`success_criteria` 和关联 Seed | Stage 1 以查看/选择为主，Stage 2 接真实 Runner |
| 运行时间线 | 解释评估运行过程 | `ExecutionEvent`、`ExecutionTrace`、后续 SSE | 展示阶段、工具调用、记忆读写、判定事件和风险演进 | 当前只有领域模型，真实 Trace/SSE 属于后续实现 |
| 报告证据 | 解释风险结论和证据链 | `EvaluationReport`、`RiskFinding`、`JudgeResult` | 展示分数、最高严重等级、finding、evidence；支持回跳到图谱路径和时间线事件 | 后端 mock `POST /evaluations`、`GET /evaluations/{id}/report` 可支撑报告展示 |
| 契约状态 | 防止字段漂移，帮助联调 | `shared/contracts`、fixtures、API 健康状态 | 展示冻结枚举、当前端点、fixture 来源和契约守卫说明 | 可先静态展示，后续接 schema 校验结果 |

## 风险模式与旗舰链路

Stage 1 必须围绕四个 `RiskPattern` 建立认知和图谱能力：

| ID | 名称 | `risk_type` | `severity` | 节点模式 |
| --- | --- | --- | --- | --- |
| `R1` | Untrusted Source to Dangerous Tool | `indirect_prompt_injection` | `HIGH` | `SOURCE → AGENT → TOOL` |
| `R2` | Untrusted Source to Persistent Memory | `memory_poisoning` | `HIGH` | `SOURCE → AGENT → MEMORY` |
| `R3` | Sensitive Data to External Sink | `privacy_leakage` | `HIGH` | `DATA → AGENT → TOOL` |
| `R4` | Persistent Indirect Prompt Injection Chain | `persistent_indirect_prompt_injection` | `CRITICAL` | `SOURCE → AGENT → MEMORY → AGENT → TOOL` |

R4 是主页面演示的旗舰链路，应在攻击图谱、总览和报告证据里都能被清楚定位。

## CorpMate v0 工具边界

Stage 1 只围绕 CorpMate v0 工具清单设计，不扩展 Calendar、File、DB 等额外工具。

| 工具/能力 | 权限 | 节点语义 | 安全标签 |
| --- | --- | --- | --- |
| `chat` | 无工具权限 | Agent 对话能力 | 无 |
| `browser.open_page` | `ALLOW` | `SOURCE` | `UNTRUSTED` |
| `email.list` | `ALLOW` | `TOOL` | 无 |
| `email.read` | `ALLOW` | `TOOL` | `SENSITIVE` |
| `email.send` | `CONFIRM` | `TOOL` | `DANGEROUS` |
| `memory.read` | `ALLOW` | `MEMORY` | `PERSISTENT` |
| `memory.write` | `ALLOW` | `MEMORY` | `PERSISTENT` |

前端展示工具、权限、节点类型和标签时，必须使用上表和 `shared/contracts` 中的冻结名称。

## 当前后端接口

README 只记录当前已存在的后端端点，不把未完成能力写成已上线功能：

| 方法 | 路径 | 前端用途 |
| --- | --- | --- |
| `GET` | `/health` | 健康状态 |
| `POST` | `/agents` | 提交 `AgentManifest`，返回 `AgentProfile` |
| `GET` | `/agents/{id}` | 读取 `AgentProfile` |
| `GET` | `/agents/{id}/graph` | 读取 `AttackGraph` |
| `POST` | `/evaluations` | 创建 Evaluation，返回 mock `EvaluationReport` |
| `GET` | `/evaluations/{id}` | 读取 Evaluation/Report |
| `GET` | `/evaluations/{id}/report` | 读取最终报告 |

当前 Runner、Trace、SSE、真实 Sandbox 执行链路还不是已完成前端接口。相关页面可以先按契约和 fixture 规划，但必须清楚标注为 Stage 2/3 接入目标。

## 冻结枚举

前端筛选、标签、图例、状态文本和数据校验只能使用冻结值。

`risk_type`：

```text
indirect_prompt_injection
unauthorized_tool_action
memory_poisoning
privacy_leakage
data_exfiltration
persistent_indirect_prompt_injection
```

`severity`：

```text
LOW
MEDIUM
HIGH
CRITICAL
```

`node.type`：

```text
SOURCE
AGENT
TOOL
MEMORY
DATA
```

`node.labels`：

```text
UNTRUSTED
TRUSTED
SENSITIVE
DANGEROUS
PERSISTENT
```

`permission`：

```text
ALLOW
CONFIRM
DENY
```

`judge_policy` / `judge_strategy`：

```text
rule
llm
composite
```

`ExecutionEvent.type`：

```text
RUN_STARTED
ANATOMY_READY
RISK_PATH_FOUND
TEST_STARTED
SEED_SELECTED
MUTATION_CREATED
TOOL_CALLED
MEMORY_WRITTEN
JUDGE_DECISION
FINDING_CREATED
RUN_FINISHED
```

## 技术栈

本项目是 pnpm workspace monorepo，主前端位于 `apps/main-platform`。

- Next.js App Router
- React function components
- TypeScript
- 项目自有 CSS 与 Tailwind CSS v4
- lucide-react 图标
- GSAP / @gsap/react 用于协调动画
- Zod 用于运行时数据校验
- same-origin BFF route handlers 位于 `app/api/**/route.ts`

不要为了主页面规划新增前端框架、组件库、状态库或动画库。后端聚合应继续放在同源 BFF route handler 后面，不把密钥暴露到 `NEXT_PUBLIC_*`。

## 常用命令

在仓库根目录执行：

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm build
corepack pnpm lint
corepack pnpm type-check
```

只针对主前端执行：

```bash
corepack pnpm -C apps/main-platform dev
corepack pnpm -C apps/main-platform build
corepack pnpm -C apps/main-platform lint
corepack pnpm -C apps/main-platform type-check
```

## 开发原则

- 以 `shared/contracts` 为需求源，不随意改名、扩展或删除冻结枚举。
- 前端页面优先服务“理解测试、运行测试、解释结果”三件事。
- 主页面模块必须能落到契约、fixture 或当前 API，不能只做静态展示。
- 图谱和动画必须表达真实安全语义，不能只是装饰。
- 当前文档规划不修改公开 API、Schema、Pydantic Model 或 TypeScript 类型。
- 新增真实行为、模块边界或 BFF 路由时，同步更新 `docs/architecture/modules-index.md` 和 `docs/architecture/extension-review-checklist.md`。
