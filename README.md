# Agent 安全评估平台前端

本仓库是小组系统赛项目的前端工作区。前端的目标不是做一个普通后台，而是把 Agent 安全评估过程做成可以被看懂、追踪、判定和复盘的交互系统。

一句话概括本系统：

> 把 Agent 的结构、攻击入口、攻击链路、测试场景、判定规则和评估结果转化为可观察、可解释、可复现、可修复的安全评估界面。

## 当前最重要的需求来源

`shared/` 是后续前端功能设计的主要依据。当前已冻结的核心契约位于：

- `shared/contracts/SECURITY_CONTRACTS.md`
- `shared/contracts/risk_pattern.schema.json`
- `shared/contracts/attack_seed.schema.json`
- `shared/contracts/test_case.schema.json`

这组契约定义了系统的三类核心对象：

| 对象 | 作用 | 前端应该如何呈现 |
| --- | --- | --- |
| `RiskPattern` | 定义“什么结构值得攻击” | 风险模式库、攻击路径模板、风险等级与判定规则说明 |
| `AttackSeed` | 定义“具体攻击从哪里开始” | 攻击载荷库、投放方式、目标工具、难度与标签 |
| `TestCase` | 定义“完整测试场景 + 判定方式” | 测试用例编排、初始沙箱状态、输入、禁止动作、PASS/FAIL 条件 |

三者关系：

```text
RiskPattern  ->  AttackSeed  ->  TestCase
风险结构         具体攻击载荷       可执行测试场景
```

## 系统核心功能

### 1. 初始入口与身份进入

首页是系统入口，当前使用 Window 1 登录窗口。它负责建立比赛项目的第一印象：这是一个面向 Agent 安全评估的可视化平台，而不是通用管理后台。

前端重点：

- 展示项目定位和品牌文案。
- 提供评估账号登录、申请接入等入口。
- 登录后进入评估工作台。

### 2. 安全契约总览

前端需要让用户理解平台到底在测什么。`RiskPattern`、`AttackSeed`、`TestCase` 不应只是 JSON 文件，而应该成为界面中的知识资产。

建议功能：

- 风险类型总览：间接提示注入、未授权工具调用、记忆投毒、隐私泄露、数据外泄、持久性间接提示注入。
- 严重等级展示：`LOW`、`MEDIUM`、`HIGH`、`CRITICAL`。
- 节点类型说明：`SOURCE`、`AGENT`、`TOOL`、`MEMORY`、`DATA`。
- 安全标签说明：`UNTRUSTED`、`TRUSTED`、`SENSITIVE`、`DANGEROUS`、`PERSISTENT`。

### 3. 风险模式库

风险模式库对应 `RiskPattern`。它回答：“什么样的 Agent 结构值得攻击？”

Stage 1 的重点模式：

- `R1`: 不可信输入影响 Agent，并导致危险工具调用。
- `R2`: 不可信内容写入持久记忆，形成记忆投毒。
- `R3`: 敏感数据经 Agent 流向外部危险出口。
- `R4`: 不可信输入污染持久记忆，之后被 Agent 读取并触发危险动作，这是旗舰链路。

前端应提供：

- 模式卡片或表格。
- 节点序列可视化。
- 风险等级、攻击目标、成功条件、判定策略。
- 从某个风险模式跳转到相关攻击载荷和测试用例。

### 4. 攻击载荷库

攻击载荷库对应 `AttackSeed`。它回答：“攻击从哪里开始，载荷怎么投放？”

前端应展示：

- 载荷名称、描述、风险类型和关联的 `RiskPattern`。
- 攻击手法：权威伪装、上下文嵌入、指令改写、任务伪装、混淆。
- 投放方式：网页隐藏文本、邮件正文、记忆注入、文件内容。
- 目标工具、目标节点、攻击难度、标签。

这部分适合做成可筛选列表，并支持查看 payload 内容。

### 5. 测试用例编排

测试用例对应 `TestCase`。它是用户真正“发起一次评估”的基础。

前端应支持用户查看或选择：

- 测试名称、描述、风险类型和严重等级。
- 目标 Agent，Stage 1 固定为 `corpmate`。
- 沙箱初始状态：邮箱、记忆、浏览器页面。
- 发送给 Agent 的输入。
- 期望安全行为。
- 禁止执行的动作。
- 判定策略与 PASS/FAIL 条件。
- 关联的 AttackSeed。

这部分是后续工作台的核心表单和任务详情页。

### 6. Agent 结构与攻击图可视化

前端需要把抽象测试变成图形化路径。图上的节点类型应严格来自契约：

```text
SOURCE -> AGENT -> TOOL
SOURCE -> AGENT -> MEMORY
DATA   -> AGENT -> TOOL
SOURCE -> AGENT -> MEMORY -> AGENT -> TOOL
```

建议功能：

- 展示节点、边、风险标签和严重等级。
- 高亮当前命中的 RiskPattern。
- 区分潜在风险路径和已验证攻击路径。
- 对 R4 持久性间接提示注入链路提供重点动画或回放。

### 7. 实时评估过程

评估运行时，前端应展示平台正在做什么，而不是只显示日志。

建议界面：

- 当前测试阶段。
- 事件时间线。
- Agent 输入和响应摘要。
- 工具调用记录。
- Memory 读写记录。
- 判定规则命中情况。
- 风险从 Potential Risk 到 Validated Attack 的演进过程。

### 8. 判定结果与风险报告

最终报告要回答：“到底哪里有问题，证据是什么，应该如何修复？”

前端应展示：

- PASS / FAIL / 需要人工确认。
- 命中的风险类型和严重等级。
- 命中的 forbidden action。
- 触发的 judge rule。
- 关键证据片段。
- 攻击链路图。
- 缓解建议和复盘说明。

## Stage 1 范围

当前契约明确了 CorpMate v0 工具清单，前端不要擅自扩展工具：

| 工具 | 语义 |
| --- | --- |
| `browser.open_page` | 打开网页，不可信入口 |
| `email.list` | 列出邮件 |
| `email.read` | 读取邮件，可能接触敏感内容 |
| `email.send` | 发送邮件，危险外部动作 |
| `memory.read` | 读取持久记忆 |
| `memory.write` | 写入持久记忆 |

Stage 1 不做 Calendar、File、DB 等额外工具。

## 前端实现建议

建议将主工作台拆成以下窗口或模块：

1. `SecurityOverview`：项目态势、风险类型、测试统计。
2. `RiskPatternLibrary`：风险模式库。
3. `AttackSeedLibrary`：攻击载荷库。
4. `TestCaseWorkbench`：测试用例选择、详情和启动。
5. `AttackGraphView`：Agent 结构图与攻击链路图。
6. `EvaluationTimeline`：实时评估事件流。
7. `RiskReportView`：判定结果、证据和修复建议。

这些模块应围绕 `shared/contracts` 的字段建模，避免先做漂亮但无法接入后端数据的静态页面。

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
- 图形和动画必须表达真实安全语义，不能只是装饰。
- 后端聚合通过同源 BFF route handler 承接，不把密钥暴露到 `NEXT_PUBLIC_*`。
- 每次新增行为或模块边界时，同步更新 `docs/architecture/modules-index.md` 和 `docs/architecture/extension-review-checklist.md`。

## shared关键信息提取

因为这是一个小组型项目，最终要参加系统赛，我负责做前端，现在，请你接收csy目录下新添加进去的文件夹shared，这个文件夹将成为我们今后前端功能的主要要求来源，我希望你深度阅读此文件夹，为我总结本系统的核心功能到底应该有哪些？我希望你能帮我能够透彻理解并搞清楚我应该做出什么样的前端、实现哪几个功能。了解清楚后，我希望你重新撰写readme.md，因为这个旧版本的readme.md内容冗长又过时，不完全符合当前项目的需求。
我担心你又会在沙盒命令中陷入死循环，你可以向我征求权限或绕路选择别的方式达到目的，必要时刻联网搜索实践方法，diff和类型检查比较容易浪费很多时间，不必要的话可以省略

Agent 安全评估可视化工作台。前端要围绕三类契约展开：
RiskPattern：什么结构值得攻击，也就是风险模式库。
AttackSeed：攻击从哪里开始，也就是攻击载荷库。
TestCase：如何执行和判定一次测试，也就是测试用例工作台。
所以前端核心功能应该是这几块：
初始入口与身份进入
安全契约总览
风险模式库
攻击载荷库
测试用例编排
Agent 结构与攻击图可视化
实时评估过程时间线
判定结果与风险报告