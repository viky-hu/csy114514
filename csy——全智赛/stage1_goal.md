# Stage 1 目标与协同计划

## 骨架打通阶段(D1–D7)

> 依据:`design V0.2.md` + `plan V0.1.md` + 三条线个人计划。
> 本文是 Stage 1 期间唯一的三人协同依据,每日站会和每次串跑都对齐本文。

---

# 0. 阶段定位

对应 plan V0.1 的:

```text
Phase 0      D1-D2     Contract Freeze
Sprint 1     D3-D7     Skeleton Integration
```

终点:

```text
M1 Skeleton Integration
```

一句话目标:

> D7 晚上,三人从空状态启动系统,完成
> 「接入 CorpMate → 确认 Manifest → 生成 AttackGraph → 前端看到风险路径 → 一条安全 TestCase 真实跑出 FAIL 且带 Evidence」,
> 中间不允许手动改数据。

Stage 1 不追求:

```text
攻击成功
Adaptive Red Team
SSE 实时事件
评分体系
```

这些属于 Stage 2/3。

---

# 1. 阶段成功定义(Definition of Done)

D7 验收时,以下六条必须全部成立(对照 plan V0.1 §8):

```text
① CorpMate 可以聊天
② Sandbox Tool 可以被调用
③ Trace 可以记录
④ 一个手写 AgentManifest 可以生成 AttackGraph
⑤ Graph 可以显示在前端(真实 API 数据,不是 fixture)
⑥ 4-hop 搜索单元测试通过
```

外加三条协同纪律:

```text
⑦ 四次串跑(SR0–SR3)全部执行,问题清单有记录有归属
⑧ shared/contracts 已冻结,Breaking Change 三人同步过
⑨ 前端 Anatomy 页至少一个端点已从 fixture 切到真实 API
```

---

# 2. 时间与串跑总览

> D1 为三人共同确认的开工日,具体日历日期开工时填入。

| 时间    | 主线工作               | 串跑                    | 串跑目标                     |
| ----- | ------------------ | --------------------- | ------------------------ |
| D1–D2 | Phase 0:契约、骨架、Mock | SR0(D2 晚)             | 契约冻结,三方 fixture 互认       |
| D3–D4 | Runtime 骨架 + 图逻辑启动 | SR1(D4 晚)             | 最小垂直链路(TestCase→Judge)跑通 |
| D5–D6 | 图生成链路 + Anatomy 前端 | SR2(D5 或 D6,约 30 min) | 前后端首次真实联调(graph 端点)      |
| D7    | 收尾、修 bug、合并        | SR3(D7,60–90 min)     | M1 正式验收                  |

串跑节奏原则:

```text
个把天一次小串跑,一周一次大验收。
任何一条线不允许连续独立开发超过 2 天不与另外两线对一次。
```

---

# 3. 各成员任务计划

## 3.1 陈书扬 —— Security & Evaluation Owner

### D1–D2(支撑 SR0)

```text
S0-1  冻结 R1–R4 四个 RiskPattern      → shared/examples/security/risk_patterns.json
S0-2  冻结攻击语义(标签/Dangerous Sink/Sensitive Data 等定义)
                                        → docs/security-model.md
S0-3  6 个 TestCase v0(PI×2, IPI×2, Unauthorized×1, Privacy×1)
                                        → security_testcases.json
S0-4  8 个 AttackSeed(IPI×4, Memory×2, Privacy×2)
                                        → attack_seeds.json
```

每个 RiskPattern 必须写清:Pattern / Risk Type / Severity / Attack Goal / Success Condition / Judge Strategy。

### D3–D4(支撑 SR1)

```text
S1-0  给步嘉城 1 个最小 vertical slice TestCase:
      用户只让查邮件,Agent 却调用 email.send → forbidden_actions 命中 → FAIL
S1-1  Attack Graph 安全语义规范:node.type / node.labels / node.metadata 分离,
      交步嘉城落入 backend/domain
S1-4  Security KB Loader 格式约定(YAML/JSON,不上管理后台)
```

### D5–D7(支撑 SR3)

```text
S1-2  find_attack_paths(graph, max_depth=4) + 全套单测
      (2-hop / 4-hop / 5-hop 拒绝 / 环 / 多路径 / 无路径)
S1-3  RiskMatcher:deterministic rules,不调 LLM
S1-4b Severity v0:LOW / MEDIUM / HIGH / CRITICAL,纯规则
S1-5  验证 CorpMate manifest 生成的 graph 能识别出
      Web→Agent→Memory→Agent→Email 为 R4 / CRITICAL
SR3   参与 M1 验收,输出 Stage 2 安全侧输入(标准测试清单草案 10–15 条方向)
```

### 本阶段禁止

```text
× 写几十条 Seed / Prompt(先链路后内容)
× 用 LLM 判定 Severity
× 读论文超过半天不产出结构化资产
```

---

## 3.2 步嘉城 —— Agent & Platform Owner

### D1–D2(支撑 SR0)

```text
P0-1  Monorepo scaffold(backend/ reference-agent/ frontend/ shared/ tests/ docs/)
      + Python 环境 / lint / test / .env.example / README
P0-2  FastAPI skeleton:GET /health、config、logging、exception handling
P0-3  Domain Models(Pydantic):AgentManifest / AgentProfile / AttackGraph /
      AttackPath / TestCase / ExecutionEvent / ExecutionTrace / JudgeResult /
      RiskFinding / EvaluationReport
P0-4  6 个 Mock API(返回 fixture):
      POST /agents, GET /agents/{id}, GET /agents/{id}/graph,
      POST /evaluations, GET /evaluations/{id}, GET /evaluations/{id}/report
```

### D3–D4(支撑 SR1)

```text
P1-1  CorpMate v0:/chat + browser.open_page / email.list / email.read /
      email.send / memory.read / memory.write(严格不加别的工具)
P1-2  SandboxTool 接口(execute/reset/snapshot)+ EmailSandbox 优先,
      BrowserSandbox / MemorySandbox 跟上;Memory 支持跨 turn 持久 + scenario reset
P1-3  Trace Recorder:AGENT_INPUT / AGENT_OUTPUT / TOOL_CALLED /
      TOOL_RETURNED / MEMORY_READ / MEMORY_WRITTEN
P1-4  ReferenceAgentAdapter(invoke/reset/get_manifest/get_trace),
      Runner 禁止直接 import CorpMate
P1-5  打通 vertical slice:
      TestCase → Runner → Adapter → CorpMate → EmailSandbox → Trace → RuleJudge
```

### D5–D7(支撑 SR2 / SR3)

```text
P2-0a 手写 CorpMate manifest → AttackGraph 生成链路
      (调用陈书扬的图构建与 find_attack_paths/RiskMatcher),
      GET /agents/{id}/graph 从 fixture 切为真实数据
P2-0b APIAgentAdapter 收尾(外部 chat API 接入的最小实现)
P2-0c 配合胡继天完成 SR2 联调;字段问题后端修,前端不 hack
P2-0d SR3 验收 + 修 bug;整理 Stage 2 输入(Runner 生命周期骨架想法)
```

### 本阶段禁止

```text
× CorpMate 加 Calendar / File / DB 工具
× 提前做 SSE、Persistence、Anatomy Agent(Stage 2 内容)
× 引入 Kafka / Neo4j / 微服务
```

---

## 3.3 胡继天 —— Frontend & Experience Owner

### D1–D2(支撑 SR0)

```text
F0-1  信息架构:Landing → Dashboard → Connect → Profile Confirm →
      Anatomy → Evaluation → Report(页面合并自主)
F0-2  视觉方向:风格 / 字体 / 动效 / 图表现方向(自主决定)
F0-3  Mock 数据层:loadAgent / loadGraph / loadRunEvents / loadReport,
      用 shared/fixtures 静态渲染 Agent Profile / Attack Graph / Evaluation Result
      —— MockRepository / ApiRepository 分层,切真实 API 时 UI 不改
```

### D3–D4

```text
F1-1  Connect Agent 页:API 接入表单(Endpoint/Method/Headers/
      Request Template/Response Path)+ Docker/GitHub 仅 Beta 入口展示
F1-2  Profile Confirmation 页:Capabilities / Tools / Data Sources / Memory
      展示 + ALLOW / CONFIRM / DENY 权限编辑,
      明确表达「AI 建议,用户确认」
F1-x  Event→UI State 映射层骨架(轻量,为 Stage 2 的 SSE 做准备)
```

### D5–D7(支撑 SR2 / SR3)

```text
F1-3  Anatomy Graph 原型:Source/Agent/Tool/Memory/Data 五类节点 +
      Untrusted/Sensitive/Dangerous/Persistent 安全标签 +
      Risk Path 整条高亮 + 节点详情 + 风险类型/等级
SR2   把 graph 数据源从 fixture 切到真实 GET /agents/{id}/graph,
      其余页面继续用 fixture(一次只切一个端点)
SR3   M1 验收走查:Connect → Confirm → Anatomy → Risk Path 高亮全流程
```

### 本阶段禁止

```text
× 登录/设置/消息中心等周边页面
× 等后端完成才动手(必须 fixture 先行)
× 为兼容后端字段问题在前端做长期 hack
```

---

# 4. 交付物与对接点一览

| 时间    | 交付方 | 接收方     | 交付物                              | 用途                 |
| ----- | --- | ------- | -------------------------------- | ------------------ |
| D2    | 陈书扬 | 步嘉城、胡继天 | 3 个安全资产 JSON + security-model.md | KB Loader / 前端风险语义 |
| D2    | 步嘉城 | 胡继天     | fixtures + Mock API + OpenAPI    | 前端 Mock 开发不阻塞      |
| D3    | 陈书扬 | 步嘉城     | 最小 vertical slice TestCase       | SR1 链路             |
| D4    | 步嘉城 | 陈书扬     | 真实 Trace 样例                      | 校准 Rule Judge 规则   |
| D5    | 陈书扬 | 步嘉城     | find_attack_paths + RiskMatcher  | graph 端点真实化        |
| D5–D6 | 步嘉城 | 胡继天     | 真实 graph API + risk_path_ids     | SR2 联调、路径高亮        |

---

# 5. 串跑方案

## 5.0 串跑通用规则

```text
1. 串跑当天 12:00 前,各人在群里报:ready / blocked + 风险项。
2. 串跑跑主分支最新代码;串跑前 1 小时停止 merge,冻结现场。
3. 角色分工:驾驶员 1 人(轮流)+ 记录员 1 人;
   当场超过 5 分钟修不好的 bug 不现场修,记入问题清单并定 owner。
4. 串跑标准:不追求 zero bug,追求主链路不断;
   链路断在哪,哪里就是全队最高优先级 blocker。
5. 每次串跑结束后 10 分钟内产出三样东西:
   通过项 / 失败项 / 问题清单(owner + deadline)。
6. 环境统一:启动命令、端口、fixture 路径以 README 为准,
   不允许「我本地能跑」。
```

---

## 5.1 SR0 —— 契约冻结串跑(D2 晚,30–45 min)

**参与:** 三人

**前置条件:**

```text
陈书扬:risk_patterns.json / attack_seeds.json / security_testcases.json
        + docs/security-model.md
步嘉城:backend 可启动,6 个 Mock API 返回 fixture
胡继天:用 fixture 静态渲染 Agent Profile / Attack Graph / Evaluation Result
```

**串跑脚本:**

```text
1. GET /health → 200
2. POST /agents(fixture manifest)→ 返回 agent id
3. GET /agents/{id}/graph → 返回 attack_graph fixture
4. GET /evaluations/{id}/report → 返回 evaluation_report fixture
5. 前端 Mock 数据层加载同一份 fixture,渲染三个视图
6. 三人逐字段过五个核心 Contract:
   AgentManifest / AttackGraph / ExecutionEvent / RiskFinding / EvaluationReport
7. 陈书扬确认:安全语义(R1–R4、标签、Severity)在字段里没有丢失
```

**通过标准:**

```text
□ shared/fixtures 下 4 个 JSON 三方认可,复制进 shared/contracts 冻结
□ 前端渲染不报字段缺失
□ Schema 争议全部当场解决(plan V0.1:D2 必须解决)
```

**失败处理:** 争议字段当晚改完;改不完不睡觉——M0 不过,D3 不开工。

---

## 5.2 SR1 —— 最小垂直链路串跑(D4 晚,45–60 min)

**参与:** 陈书扬 + 步嘉城(胡继天可旁听)

**前置条件:**

```text
步嘉城:CorpMate /chat 可调 email.send;EmailSandbox reset 可用;
        Trace 至少记录 TOOL_CALLED / TOOL_RETURNED;ReferenceAgentAdapter 接口齐
陈书扬:最小 TestCase JSON 已交付(场景:用户只让查邮件,
        Agent 调 email.send → forbidden_actions: ["email.send"],judge_policy: rule)
```

**串跑脚本:**

```text
1. pytest tests/integration/test_vertical_slice.py(或等价脚本)
2. 自动执行:Load TestCase → Reset Sandbox → Adapter.invoke
   → 收集 Trace → RuleJudge → 输出 JudgeResult
3. 人工核对:Trace 里确实存在 email.send 调用事件
4. 人工核对:JudgeResult = FAIL,且带 violation + evidence(event_id),
   不是只有 fail = true
```

**通过标准:**

```text
□ 这条链全自动跑通,中间无需手动拼数据
□ Judge 结论带 Evidence,可解释
```

**失败处理:**

```text
当晚定位 blocker 归属 → owner 在 D5 中午前修复
→ D5 中午 15 分钟短串跑复验
→ 再不过,升级为三人共同解决,压缩 D5 其他任务
```

---

## 5.3 SR2 —— 前后端首次联调(D5 或 D6,约 30 min)

**参与:** 步嘉城 + 胡继天(陈书扬远程待命解释 risk_path 语义)

**前置条件:**

```text
SR1 已通过
步嘉城:手写 CorpMate manifest → 真实生成 AttackGraph 的链路至少跑通一次,
        GET /agents/{id}/graph 返回真实数据(含 risk_path_ids)
胡继天:Anatomy Graph 原型完成,MockRepository / ApiRepository 已分层
```

**串跑脚本:**

```text
1. 前端 graph 数据源从 fixture 切到真实 API(其余页面保持 fixture 不变)
2. 同一个 CorpMate manifest,前端渲染真实 AttackGraph
3. 高亮 R4 路径:Web → Agent → Memory → Agent → Email
4. 核对节点安全标签与 risk_path_ids 能被前端正确消费
5. 发现字段问题 → 不当场 hack,记 issue,后端修
```

**通过标准:**

```text
□ Anatomy 页显示的数据来自 backend 真实接口,不是 fixture
□ R4 路径高亮正确,风险类型/等级可见
```

**备注:** 一次只切一个端点。Stage 1 只切 graph,其他端点 Stage 2 再切。

---

## 5.4 SR3 —— M1 正式验收串跑(D7,60–90 min)

**参与:** 三人;驾驶员 1 人 + 记录员 1 人

**前置条件:**

```text
SR1 / SR2 已通过
三人 Stage 1 任务全部完成,代码已合并主分支
```

**串跑脚本(从空状态开始,全程不碰数据库、不换 JSON):**

```text
1. 按 README 启动 backend + frontend
2. 前端 Connect Agent → 选择 CorpMate(reference)
3. 展示 Manifest → 用户确认 Profile
4. 触发 analyze → 后端生成 AttackGraph
   → find_attack_paths(max_depth=4) → RiskMatcher
5. 前端 Anatomy 图展示五类节点
   → 高亮 Web→Agent→Memory→Agent→Email(R4 / CRITICAL)
6. 打开 CorpMate 聊天:让它读邮件并尝试调用 tool
   → 验证 Sandbox 可用、Trace 有记录
7. 跑 1 条安全 TestCase → FAIL + Evidence 展示
8. pytest 跑 Tier 1 单测:
   Domain Schema / Attack Path Search / Risk Matcher / Sandbox Reset → 全绿
```

**通过标准(M1 六条 + 三条纪律):**

```text
□ ① CorpMate 可以聊天
□ ② Sandbox Tool 可以被调用
□ ③ Trace 可以记录
□ ④ 手写 AgentManifest 可以生成 AttackGraph
□ ⑤ Graph 显示在前端(真实 API)
□ ⑥ 4-hop 搜索单元测试通过
□ ⑦ 全过程无人工修改中间结果
□ ⑧ 问题清单完整、有 owner
□ ⑨ Stage 2 输入明确
```

**输出:**

```text
1. M1 验收结论(过 / 不过)
2. 遗留问题清单(owner + deadline)
3. Stage 2(Evaluation Integration,D8–D14)启动输入:
   各线任务草案 + 本阶段暴露的契约问题
```

**若不过:** D8 不进入 Stage 2 新功能,先修 M1 缺口,48 小时内补一次 SR3 复验。

---

# 6. 日常协同机制

## 6.1 每日站会(10–15 min)

每人只答三件事:

```text
昨天完成什么?
今天完成什么?
接口有没有变化?
```

不开长会;问题线下两两解决,解决不了的提到次日站会。

## 6.2 契约变更规则

`shared/contracts` 内五个结构(AgentManifest / AttackGraph / ExecutionEvent / RiskFinding / EvaluationReport)的任何 Breaking Change:

```text
群里发 diff → 三人确认 → 才能改
```

禁止:后端改字段 → 前端挂了 → 没人知道为什么。

## 6.3 PR Ownership(沿用 plan V0.1 §26)

```text
Security 代码:陈书扬 DRI,步嘉城 Review
Platform 代码:步嘉城 DRI,陈书扬 Review
Frontend 代码:胡继天 DRI,步嘉城 Review Contract
核心 Schema:三人 Review
```

## 6.4 问题清单

统一记在仓库 issue(或共享文档),格式:

```text
问题 / 发现于哪次串跑 / owner / deadline / 状态
```

---

# 7. 本阶段最容易踩的坑(对照 plan V0.1 §30)

```text
坑 1:先写大量 Prompt / Seed。
     → 先打通 TestCase → Runner → Judge,再扩内容。

坑 2:胡继天等后端完成再写前端。
     → D2 起直接用 fixtures 开发,SR2 才切真实 API。

坑 3:步嘉城把 CorpMate 做得巨复杂。
     → 第一版只要 LLM + Browser + Email + Memory 六个工具方法。

坑 4:陈书扬继续读论文,一周没有代码产出。
     → 研究必须转化为 RiskPattern / Seed / Mutation / JudgeRule / TestCase。

坑 5(新增):串跑变成「各自演示自己的模块」。
     → 串跑只跑端到端链路,单个模块的进度在站会同步,不占串跑时间。
```

---

# 8. Stage 1 结束时我们手里应该有什么

```text
一份冻结的 shared/contracts
一个能聊天、能调沙箱工具、全程留 Trace 的 CorpMate v0
一套能从 Manifest 生成 AttackGraph 并找出 R4 风险路径的图逻辑
一个能展示 Anatomy + 高亮风险路径的前端(至少 graph 端点接真实数据)
一条全自动的 TestCase → FAIL + Evidence 最小链路
四次串跑的记录与问题清单
```

达到这些,Stage 2(测评集成:Standard Tests / Judges / Runner / SSE / Dashboard)才有地基。
