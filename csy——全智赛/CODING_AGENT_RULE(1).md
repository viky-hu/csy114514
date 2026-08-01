# CODING_AGENT_RULE.md

## Contract 守护规则 v1.0

> 发布人:组长(Security & Evaluation Owner)。
> 适用范围:全体开发者 + 所有 AI Coding Agent。
> 使用方式:每次给 AI Coding Agent 派任务时,把本文件作为上下文的一部分喂给它。
> 本文件优先级高于任何个人偏好、任何框架惯例、任何 AI 认为"更好"的命名建议。

---

# 0. 为什么有这份规则

三个人 + AI Coding Agent 并行开发,最容易死的不是算法,而是同一件事有三个名字:

```text
Security 模块:   risk_type
Backend API:     risk_category
Frontend:        riskKind
```

表达的是同一件事,但系统接不上。
这类 bug 不在任何人的单测里爆炸,只在串跑时爆炸。

对策只有一条:

> **shared/contracts/ 是整个项目的公共法律。**
> **法律里没有的名字,代码里不允许存在。**

注意:本文件不是第二份契约定义,而是"关于契约的法律"。
若本文件与 `shared/contracts/` 的实际文件不一致,**以 shared/contracts/ 为准**,并顺手修正本文件。

---

# 1. 唯一事实来源(Single Source of Truth)

```text
shared/contracts/
```

铁律:

```text
① 所有核心数据结构在这里定义,且只在这里定义。
② backend/domain 的 Pydantic 模型必须与 contracts 逐字段一致。
③ frontend 的 TypeScript 类型从 OpenAPI / contracts 生成,禁止手写平行类型。
④ 任何模块(anatomy / judges / redteam / evaluators / frontend)
   不得定义"自己的一套"等价结构。
```

design V0.2 §3 明令禁止的平行结构:

```text
× Anatomy 自己定义一套 Agent JSON
× Frontend 再定义一套 Graph JSON
× Judge 再定义一套 Test Result
```

---

# 2. 冻结契约清单

以下 8 个契约,自 SR0(M0)验收通过后冻结。
冻结对象 = 字段名 + 字段类型 + 枚举值 + 语义,四者全部受控。

```text
AgentManifest      用户接入 Agent 的声明(能力/数据源/记忆/工具权限)
AgentProfile       Anatomy 产物(能力画像 + 安全资产标注)
AttackGraph        攻击图(节点 + 安全标签 + 边)
AttackPath         一条命中的风险路径
TestCase           一条测试(场景/输入/期望/禁止行为/判定策略)
ExecutionEvent     执行与 SSE 共用的统一事件
RiskFinding        一条确认的风险(含 Evidence)
EvaluationReport   上线报告(分数 + Findings + 结论)
```

同一法律还覆盖 design V0.2 §3 的其余 Domain Model:

```text
RiskPattern / AttackSeed / TestScenario / JudgeResult /
ExecutionTrace / EvaluationRun
```

各契约字段以 `shared/contracts/` 实际文件为准,此处不重复定义——
**重复定义正是本规则要消灭的东西。**

Security Line 的三个 Contract(RiskPattern / AttackSeed / TestCase)
字段定义、枚举冻结、校验规则、CorpMate 工具清单详见:
`shared/contracts/SECURITY_CONTRACTS.md`
机器校验用 JSON Schema 见同目录下的 `*.schema.json`。

## 2.1 全局枚举与命名冻结(最容易漂移的部分,单独列出)

以下名字全项目唯一,任何一端出现别名即违规:

```text
风险类型字段名:   risk_type
                 (不是 risk_category,不是 riskKind,不是 riskType)

风险类型取值:     risk_type ∈ indirect_prompt_injection |
                              unauthorized_tool_action |
                              memory_poisoning |
                              privacy_leakage |
                              data_exfiltration |
                              persistent_indirect_prompt_injection

严重等级:         severity ∈ LOW | MEDIUM | HIGH | CRITICAL

工具权限:         permission ∈ ALLOW | CONFIRM | DENY

图节点类型:       node.type ∈ SOURCE | AGENT | TOOL | MEMORY | DATA

节点安全标签:     labels ⊆ {UNTRUSTED, TRUSTED, SENSITIVE, DANGEROUS, PERSISTENT}

边类型:           edge.type ∈ READ_FROM | WRITE_TO | CALL | PASS_DATA | CONTROL

事件类型:         type ∈ RUN_STARTED | ANATOMY_READY | RISK_PATH_FOUND |
                 TEST_STARTED | SEED_SELECTED | MUTATION_CREATED |
                 TOOL_CALLED | MEMORY_WRITTEN | JUDGE_DECISION |
                 FINDING_CREATED | RUN_FINISHED

事件公共字段:     event_id | run_id | timestamp | type | payload

序列化命名:       wire format(JSON / REST / SSE)一律 snake_case。
                 前端 TS 内部想要 camelCase:只能由生成器自动映射,
                 禁止手写改名、禁止手写双份类型。
```

---

# 3. 简单规则(唯一需要背下来的部分)

> **契约里没有的,不许写;要改契约,先过人。**

展开成 5 条:

## R1 引用,不定义

用到契约概念时,import / 引用契约类型。
不重新定义、不新建"差不多"的结构体、不在注释里口头约定。

## R2 不改名、不删字段、不改语义

这三件事 = Breaking Change。
必须走 §4 变更流程,三人书面确认(群消息留痕)后才允许动手。
包括组长本人,包括 AI Coding Agent,没有例外。

## R3 加字段也要说一声

新增可选字段不算 Breaking,但必须:

```text
当天在群里同步 → 补进 shared/contracts → 同 PR 更新 fixture
```

偷偷加字段 = 违规,即使"后端多给前端忽略就行"。

## R4 不许绕

发现契约缺东西、不顺手、不够用:

```text
正确动作:提变更(§4)
禁止动作:本地写 mapping 层 / 兼容层 / 字段别名 /
         old_field 与 new_field 双写
```

比赛项目养不起兼容层,契约保持简洁。

## R5 AI Agent 开工三问

写任何一行代码前,先回答:

```text
① 我要用的这个字段,contracts 里有吗?
② 我要写的这个类型,contracts 里有吗?
③ 我要改的这个文件,它的输出被哪份契约承认?
```

有一个答不上来 → 停下来问人类 owner,**不许自己造**。

---

# 4. 契约变更流程(唯一合法通道)

```text
1. 提案   群里发变更单:
          字段 / 旧定义 / 新定义 / 理由 / 影响哪些模块

2. 确认   三人全部明确同意(文字留痕)。
          组长有一票否决权。

3. 落地   顺序固定:
          先改 shared/contracts
          → 再改各模块实现
          → 补/改 contract test
          → 同 PR 更新 shared/fixtures

4. 同步   当日站会通报;
          相关 PR 描述里必须链接变更单。
```

紧急情况(串跑现场炸了):

```text
允许口头确认先改,但当天必须补变更单。
不补 = 违规。
```

---

# 5. AI Coding Agent 执行检查清单

## Before Coding

```text
□ 读完 shared/contracts/ 中与本任务相关的全部定义
□ 读完相关模块的现有接口与测试
□ 任务涉及的每个字段名,都能在 contracts 里找到
□ 明确本任务允许修改的目录(见各线 plan 的 Ownership 章节)
```

## During Coding

```text
□ 只引用契约类型,不新建平行类型
□ 不"顺手优化"契约字段名,哪怕你觉得现在的名字不好
□ 序列化输出一律 snake_case,与 wire format 一致
□ 需要契约里没有的东西 → 停下,向人类 owner 提变更
□ 不引入契约外的枚举值(包括"就多加一个事件类型试试")
```

## Before Completion

```text
□ 跑相关单测 + contract test
□ PR 描述写明:
  Changed Files / Contract Impact(引用了哪些契约、是否变更)/
  Tests Added / Tests Passed / Known Limitations
□ 若 diff 触及 shared/contracts/:
  PR 必须三人 review,且描述里链接变更单,缺一不合入
```

---

# 6. 违规判定(举例)

| 行为 | 判定 |
|------|------|
| 前端把 `risk_type` 手写改名 `riskKind` 进 TS 类型 | 违规(R1/R4),退回 |
| 后端为省事在 response 里加 contracts 没有的字段 | 违规(R3),走变更或删掉 |
| Judge 模块自定义一套 TestResult 结构 | 违规(R1),必须复用 JudgeResult |
| AI Agent 认为 camelCase"更前端规范",擅改 wire 字段 | 违规(R2),契约高于框架惯例 |
| Anatomy 输出一个与 AgentProfile 略不同的 JSON | 违规(R1),design V0.2 §3 明令禁止 |
| 发现 TestCase 缺 timeout 字段 → 群里发变更单 → 三人确认 → 按 §4 顺序落地 | 合法,教科书式操作 |

---

# 7. 技术兜底

规则靠人自觉,也靠机器兜底:

```text
① contract test:
   contracts 目录下每个结构必须有
   序列化/反序列化 round-trip 测试 + 枚举值校验测试。

② fixture 守门:
   shared/fixtures/ 里所有样例 JSON
   必须随时通过契约校验;
   契约变更与 fixture 更新必须在同一个 PR。

③ CI / 串跑检查:
   每次串跑(SR0–SR3)第一项:
   各端实际输出与 contracts 逐字段核对。
```

---

# 8. 规则的规则

```text
① 本文件由组长维护;修改本文件本身,同样要三人确认。
② 本文件故意写得很短。
   凡是"这里没说清楚我能不能……"的情况,答案一律是:先问,再写。
③ 守契约不是官僚主义。
   它是三个人加 AI 并行开发时,系统最后还能接得上的唯一原因。
```
