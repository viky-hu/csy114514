# Frontend & Experience Line

## 组员 B / Frontend Owner 开发计划 v0.1

> 本计划定义前端必须表达的信息、交互和接口，但不规定视觉语言。  
> Frontend Owner 对视觉风格、组件设计、动画方式、页面合并与布局拥有较高自主权。

---

# 1. 角色定位

Owner：

**Frontend & Experience Owner**

核心目标：

> 把复杂的 Agent 安全技术转换成用户和评委能够直观看懂的产品体验。

主要负责：

```text
Frontend Architecture

Visual Language

Interaction

Dashboard

Agent Connection

Profile Confirmation

Anatomy Visualization

Attack Graph

Evaluation Running

Attack Animation

Report
```

---

# 2. 最重要的设计目标

前端不是：

> 给后端套一层 CRUD 页面。

而需要回答三个用户问题：

### ① 我的 Agent 是什么结构？

```text
Anatomy
```

### ② 平台正在怎么攻击它？

```text
Evaluation Running
```

### ③ 到底哪里有问题？

```text
Risk Report
```

这三项体验优先级高于：

```text
复杂用户系统

设置页面

消息中心

大量 Dashboard Widget
```

---

# 3. Source of Truth

前端数据一律来自：

```text
OpenAPI

shared/contracts

shared/fixtures
```

禁止根据后端内部实现猜字段。

核心 Contract：

```text
AgentManifest

AgentProfile

AttackGraph

AttackPath

ExecutionEvent

RiskFinding

EvaluationReport
```

---

# 4. Contract First

后端未完成时直接使用：

```text
shared/fixtures/
```

开发。

例如：

```text
agent_manifest.json

attack_graph.json

run_events.json

evaluation_report.json
```

Frontend Owner 不需要等待 Platform Owner。

---

# 5. API 边界

预计核心接口：

```text
POST /agents

GET /agents/{id}

POST /agents/{id}/analyze

GET /agents/{id}/graph

POST /evaluations

GET /evaluations/{id}

GET /evaluations/{id}/events

GET /evaluations/{id}/findings

GET /evaluations/{id}/report
```

若接口字段与 Contract 不一致：

> 不在前端做长期兼容 Hack。

通知 Platform Owner 修正。

---

# 6. Event Contract

动态页面主要消费：

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

事件统一：

```text
event_id

run_id

timestamp

type

payload
```

前端应建立：

```text
Event → UI State
```

映射层。

不要让组件直接解析所有 Event 原始结构。

---

# 7. 前端内部推荐结构

具体框架自由。

建议逻辑层至少区分：

```text
api/

contracts/

stores/

features/

components/

visualizations/

pages/
```

其中：

```text
visualizations/
```

重点承载：

```text
Anatomy Graph

Attack Path

Execution Trace

Score Visualization
```

---

# 8. Phase 0 — D1-D2

## UX Direction & Mock First

---

## Task F0-1：Information Architecture

必须覆盖用户流程：

```text
Landing

Dashboard

Connect Agent

Profile Confirm

Anatomy

Evaluation

Report
```

可以：

```text
合并页面

修改导航

改变顺序表现
```

只要业务流程不丢。

---

## Task F0-2：视觉方向

Frontend Owner 自主确定：

```text
Style

Typography

Motion

Color

Component Language

Graph Style
```

鼓励形成明显作品风格。

但必须优先：

```text
信息层级

可读性

风险突出

动画不妨碍理解
```

---

## Task F0-3：Mock Data Layer

使用 fixture 完成：

```text
loadAgent()

loadGraph()

loadRunEvents()

loadReport()
```

后面切真实 API 时：

> UI 层尽量不改。

---

# 9. M0 Frontend Gate

D2：

至少能静态展示：

```text
Agent Profile

Attack Graph

Evaluation Result
```

并确定视觉方案。

---

# 10. Sprint 1 — D3-D7

## Connect & Anatomy

---

## Task F1-1：Connect Agent

表达：

```text
API               Available

Docker            Beta

GitHub            Beta
```

API 接入支持：

```text
Endpoint

Method

Headers

Request Template

Response Path
```

Advanced：

```text
Trace Capability
```

---

## Task F1-2：Profile Confirmation

展示 AI 推断结果：

```text
Capabilities

Tools

Data Sources

Memory

Permissions
```

权限编辑：

```text
ALLOW

CONFIRM

DENY
```

此处用户必须明确知道：

> AI 只是建议，最终 Profile 由用户确认。

---

# 11. Task F1-3：Anatomy Visualization

必须表达节点：

```text
Source

Agent

Tool

Memory

Data
```

安全状态：

```text
Untrusted

Sensitive

Dangerous

Persistent
```

具体表现：

> Frontend Owner 自由设计。

---

# 12. Attack Path 表现要求

至少能：

```text
高亮整条路径

查看节点详情

查看风险类型

查看风险等级
```

例如：

```text
Web
 ↓
Agent
 ↓
Memory
 ↓
Agent
 ↓
Email
```

必须一眼能看出：

```text
哪里是攻击入口

哪里是关键中间节点

哪里是危险 Sink
```

---

# 13. M1 Frontend Gate — D7

真实/Mock 数据都可以。

用户必须能够：

```text
Connect

Confirm Profile

See Anatomy

See Risk Path
```

此时不用动态攻击。

---

# 14. Sprint 2 — D8-D14

## Evaluation Experience

---

## Task F2-1：Evaluation Running

核心信息：

```text
当前 Test

总进度

当前风险类别

Agent 输出

Tool Call

Judge Result
```

不要只做：

```text
Progress Bar 47%
```

测试过程本身就是产品卖点。

---

## Task F2-2：Event State Engine

根据 SSE Event 更新状态。

例如：

```text
TOOL_CALLED
```

触发：

```text
Graph node highlight

Trace append

Current action update
```

而：

```text
JUDGE_DECISION
```

触发：

```text
Test result update

Risk marker
```

---

## Task F2-3：Execution Trace

至少展示：

```text
Timestamp

Event Type

Target

Action

Result
```

允许用户：

```text
展开 payload
```

但默认不应该让评委看到一大坨 JSON。

---

## Task F2-4：Score Summary

展示：

```text
Release Score

Capability

Reliability

Security
```

以及：

```text
Critical

High

Medium

Low
```

重点突出：

```text
Security
```

但不要让其他两项看起来只是占位。

---

# 15. M2 Frontend Gate — D14

真实 Evaluation Run 能展示：

```text
progress

tool events

judge

result

score
```

用户能从：

```text
Run
```

进入：

```text
Finding
```

查看 Evidence。

---

# 16. Sprint 3 — D15-D21

## Flagship Experience

这是 Frontend Line 最重要的阶段。

---

# 17. Task F3-1：Attack Path Animation

旗舰路径：

```text
Web
 ↓
Agent
 ↓
Memory
 ↓
Agent
 ↓
Email
```

动态事件：

```text
Web consumed

Memory written

New session

Memory read

Email called

Violation
```

每一步必须与真实 SSE Event 对应。

禁止纯播放与系统运行无关的假动画。

---

# 18. Task F3-2：Mutation Visualization

展示：

```text
Seed #08

Mutation #1
FAIL

Mutation #2
FAIL

Mutation #3
SUCCESS
```

可进一步体现：

```text
Attack strategy

iteration

score
```

但不要求展示复杂算法细节。

评委应能理解：

> 攻击不是固定 Prompt，而是在根据反馈继续尝试。

---

# 19. Task F3-3：Potential → Validated

这是推荐的核心视觉概念：

初始：

```text
Potential Risk Path
```

动态验证后：

```text
Validated Attack Path
```

可视觉上从：

```text
灰 / 虚线 / 未验证
```

转成：

```text
高亮 / 实线 / Critical
```

具体视觉自由。

---

# 20. Task F3-4：Risk Detail

必须展示：

```text
Risk Name

Severity

Attack Path

Attack Input

Execution Trace

Policy Violation

Why It Matters

Mitigation
```

---

# 21. Flagship Report

推荐重点：

```text
Persistent Indirect Prompt Injection

CRITICAL
```

并明确：

```text
Potential Risk
        ↓
Dynamic Attack
        ↓
Validated
```

这比单独展示：

```text
Security Score = 43
```

更重要。

---

# 22. Safe vs Vulnerable

如果时间允许，设计对比：

```text
CorpMate Vulnerable

vs

CorpMate Safe
```

同一攻击：

```text
Vulnerable
→ Attack Success

Safe
→ Chain Blocked
```

非常适合答辩展示平台检测价值。

---

# 23. M3 Frontend Gate — D21

从开始运行，到最终报告：

```text
不得刷新页面才能继续

不得人工切换 Mock

不得手动决定攻击成功
```

UI 必须消费真实事件。

---

# 24. Sprint 4 — D22-D28

## Visual Polish

Frontend Owner 此阶段拥有最高自由度。

重点：

```text
Landing

Motion

Transitions

Loading

Empty State

Error State

Graph Layout

Report Polish

Responsive Layout

Demo Presentation
```

---

# 25. 不要浪费时间做

M3 前禁止优先：

```text
Login 动画

Profile Center

复杂 Settings

Team Management

Pricing

Dark/Light 双主题

大量无意义 Dashboard Charts
```

除非核心体验已经稳定。

---

# 26. 前端性能边界

Attack Graph v0.1：

```text
小图
```

无需为了未来大图做复杂 Canvas/WebGL 优化。

先保证：

```text
5-30 nodes
```

体验优秀。

---

# 27. 对后端 Contract 的处理规则

后端增加字段：

```text
前端可以忽略
```

后端删除字段或改变含义：

```text
必须同步
```

Frontend Owner 不应偷偷：

```text
兼容 old_field/new_field 两套半年
```

比赛项目需要 Contract 简洁。

---

# 28. AI Coding Agent Rules

每次给 AI Agent 的任务应该包含：

```text
Target Feature

Relevant Contract

Mock Fixture

Expected Interaction

Files Allowed To Modify
```

例如：

```text
Implement AttackGraph visualization.

Input contract:
AttackGraph v0.2

Do not change:
API schema

Required:
highlight risk_path_ids

Mock:
shared/fixtures/attack_graph.json
```

---

# 29. AI Agent 禁止行为

未经 Frontend Owner 决定：

```text
不要自动替换 UI framework

不要大规模重构视觉系统

不要修改全局设计语言

不要自行改变 Contract

不要为了快速实现删除动画状态模型
```

---

# 30. Component 与 Business State 分离

例如：

```text
AttackGraphView
```

负责展示。

而：

```text
EvaluationRunStore
```

负责：

```text
当前事件

当前节点

当前 Test

当前 Mutation

当前 Finding
```

避免：

```text
所有 SSE 逻辑直接写进 Graph Component
```

这样未来换视觉实现，不影响业务状态。

---

# 31. Mock → Real API 迁移要求

Phase 0 就使用真实 Contract fixture。

这样之后：

```text
MockRepository
        ↓
ApiRepository
```

切换即可。

不要到 D10 才第一次看真实数据结构。

---

# 32. 三线协作节点

## D2

拿到：

```text
Schema / Fixtures
```

---

## D7

拿到：

```text
真实 CorpMate Manifest / Graph
```

---

## D14

拿到：

```text
真实 Evaluation Events
```

---

## D21

拿到：

```text
真实 Adaptive Attack Stream
```

每个阶段都替换一部分 Mock。

而不是：

> D20 一次性全部接后端。

---

# 33. 本线 Definition of Done

完成意味着用户能够：

```text
接入 Agent

理解 Agent 结构

看到攻击面

看到系统实时测什么

看到攻击如何演进

看到哪条攻击链被真正打通

理解为什么是风险

获得清晰上线结论
```

最终目标不是：

> “页面很好看。”

而是：

> **页面既有风格，又把这个复杂的技术故事讲得比 PPT 更直观。**
