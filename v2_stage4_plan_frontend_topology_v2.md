# Stage 4 Frontend Line - AgentTopology 完整交互与实施方案 V2

> 编制日期: 2026-09-11  
> 编制人: AI Coding Agent  
> 审阅人: 陈书扬、胡继天、步嘉城  
> 状态: Draft，待三人确认后执行  
> 适用项目: AgentProof `apps/main-platform`  
> 基线文档: `docs/frontend-map.md`、`docs/stage4_plan_frontend_topology.md`、`docs/stage4_plan_backend_topology.md`  
> 目标: 在不新增工作区、不破坏 Stage 3 单 Agent 流程的前提下，把拓扑配置、能力核验、拓扑测评、风险图谱与证据报告连成一条可操作、可解释、可验收的用户路径。

---

## 0. 文档性质与边界

本文件是对原 `stage4_plan_frontend_topology.md` 的完整化方案，不直接宣布新的公共契约。

本文中的界面布局、组件拆分和页面跳转属于前端实施建议；涉及以下公共字段或枚举的内容，必须先按 `CODING_AGENT_RULE.md` 完成三人确认，再修改 `csy——全智赛/shared/contracts/`、后端模型、OpenAPI 和前端生成类型：

- `AgentTopology`、`TopologyNode`、`TopologyEdge`
- `topology_type`
- `KNOWLEDGE_BASE`
- `plan_contamination`
- `rag_context_poisoning`
- `knowledge_base_docs`
- 如需运行时按拓扑节点展示事件，相关 `ExecutionEvent.payload` 语义

前端不得在业务目录中手写一套与后端平行的拓扑类型。若公共契约尚未落地，前端只允许先完成无数据依赖的静态视觉稿或原型，不进入正式业务代码。

### 0.1 本阶段包含

1. 在“初始接口”中选择并应用三种拓扑预设。
2. 让当前 Agent 和当前拓扑成为七个工作区共享的上下文。
3. 在“安全画像”中核验拓扑节点、能力边界和不可信数据流。
4. 在“测评运行”中推荐并执行与当前拓扑兼容的 R1-R6 用例。
5. 在“攻击图谱”中展示 R5/R6 潜在路径，并在有 Finding 时标记为已验证。
6. 在“测评报告”中展示拓扑信息、风险覆盖和动态证据路径。
7. 在“总览”中提供轻量拓扑摘要和后续动作入口。

### 0.2 本阶段不包含

1. 不新增第八个侧边栏工作区。
2. 不实现自由拖拽的拓扑编辑器。
3. 不允许用户任意创建节点、边和新角色。
4. 不引入 D3、ECharts、React Flow、vis.js 等图形库。
5. 不实现真正的多 Agent Runtime；界面只表达后端能够提供和验证的事实。
6. 不把“拓扑存在”误写成“拓扑风险已经被验证”。

---

## 1. 产品定位

### 1.1 一句话定位

> 用户先声明被测 Agent 的结构，再核对结构中的信任边界，随后运行结构专属的安全测试，最后通过攻击路径和证据报告判断风险是否真实成立。

### 1.2 用户需要回答的五个问题

| 工作区 | 用户问题 | 页面职责 |
| --- | --- | --- |
| 初始接口 | 我的 Agent 是什么结构？ | 配置并应用拓扑 |
| 安全画像 | 每个节点能接触什么、能调用什么？ | 核验能力边界与不可信流向 |
| 测评运行 | 应该用哪些用例测试这个结构？ | 推荐、执行、观察测试 |
| 攻击图谱 | 风险可能沿哪些节点传播？ | 展示潜在路径与已验证路径 |
| 测评报告 | 风险是否真的发生，证据是什么？ | 汇总 Finding、Evidence 和覆盖率 |

### 1.3 核心设计原则

1. **拓扑是当前 Agent 的属性，不是独立页面。**
2. **配置与验证分离。** 选择拓扑只改变被测结构；只有测评 Finding 才能把路径标为“已验证”。
3. **一个画布，一个职责。** 安全画像展示能力边界，攻击图谱展示风险传播，不重复绘制两张含义相同的拓扑图。
4. **从当前 Agent 出发。** 保存 Agent 后，画像、测评、图谱和报告必须消费同一个 `activeAgentId`。
5. **渐进披露。** 首屏显示拓扑名称、关键节点和风险入口；节点工具、边字段和证据细节通过点击检查器展开。
6. **Single 完全兼容。** 未配置拓扑或接口失败时，回到 `single`，原 Stage 3 页面和 R1-R4 流程不改变。

---

## 2. 当前前端现状与必须修复的断点

### 2.1 已有能力

- 应用是单路由、七工作区、React 状态切换的主窗口。
- `MainWindow` 已持有 `activeAgentId`。
- “初始接口”已有 AgentManifest 表单、右侧画像预览和保存动作。
- “安全画像”已有四列 SVG 能力边界图、节点点击检查器和防御机制入口。
- “攻击图谱”已有真实 API Repository、SVG 路径、路径卡片和右侧检查器。
- “测评运行”已有 TestCase 搜索、风险筛选、批量选择、SSE 事件流和运行状态。
- “测评报告”已有评分、Finding 列表、Evidence 详情和 ReportSummary。
- 后端已有 `/topology/presets`、`/topology/{agent_id}` 和拓扑感知图构建逻辑。

### 2.2 当前断点

| 编号 | 断点 | 当前表现 | 本方案要求 |
| --- | --- | --- | --- |
| C1 | 安全画像仍使用 fixture | 保存其他 Agent 后画像不变 | 根据 `activeAgentId` 加载真实 Profile、Graph、Topology |
| C2 | 测评 Provider 丢弃 `activeAgentId` | 测评对象与刚配置的 Agent 脱节 | 当前 Agent 作为默认且A
唯一明确的单体测评对象 |
| C3 | 测评对象下拉是固定 Bare/Defended | 用户可能给 A 配拓扑，却测了 B | 拆分“当前对象”与“对比模式”，避免身份漂移 |
| C4 | 风险筛选硬编码 R1-R4 | R5/R6 无入口 | 风险选项由 TestCase 数据和当前拓扑共同决定 |
| C5 | Anatomy 路径构造硬编码 R1-R4 | 多 AGENT 节点会取错；R5/R6 无步骤 | 按 `risk_pattern_id`、节点角色和边关系构造路径 |
| C6 | 报告证据路径固定为 R4 五节点 | R5/R6 Finding 会显示错误链路 | 根据 Finding 和 Trace 动态生成证据路径 |
| C7 | 图谱没有关联当前报告 | 真实 API 图仍全部显示“待验证” | 通过当前 evaluation session 读取报告并合并状态 |
| C8 | Topology 尚未进入前端 BFF/OpenAPI | 前端无法合法消费 | 先完成契约和 OpenAPI，再生成前端类型 |
| C9 | R5/R6 TestCase 未被 Loader 读取 | 前端筛选 R5/R6 会为空 | 后端修正文件发现规则并通过 TestCase 契约校验 |
| C10 | 拓扑仅内存保存 | 后端重启后恢复 single | Demo 明确限制，或在后端增加持久化后再承诺长期保存 |

---

## 3. 总体用户旅程

```text
左侧 06 初始接口
  选择拓扑并查看即时预览
          |
          | 保存 Manifest 成功
          | 应用 Topology 成功
          v
左侧 02 安全画像
  核对节点职责、信任边界、工具权限和不可信数据流
          |
          | 点击“测评此拓扑”
          v
左侧 04 测评运行
  自动带入当前 Agent，推荐 R5 或 R6 用例，启动批量测评
          |
          | SSE 展示真实执行事件
          v
左侧 03 攻击图谱
  查看潜在路径；已有 Finding 的路径显示“已验证”
          |
          | 查看报告
          v
左侧 05 测评报告
  查看拓扑类型、风险覆盖、Finding、Evidence 和修复建议
```

用户可以通过侧边栏自由进入任意工作区，但所有页面都必须明确显示当前 Agent，防止用户不知道自己正在配置或测评哪个对象。

---

## 4. 三种拓扑的完整操作流程

### 4.1 Single Agent 基线流程

1. 用户进入“初始接口”，默认选中“单 Agent”。
2. 用户填写 Agent ID、能力、数据源、记忆和工具权限。
3. 右侧预览保持当前 Manifest/Profile 摘要，不额外扩大拓扑区域。
4. 用户点击“保存并应用”。
5. 前端保存 Manifest，并将 topology 设为 `single`。
6. 页面进入“安全画像”，继续显示当前四列能力边界图。
7. 点击“测评此拓扑”后，测评页默认展示 R1-R4，不推荐 R5/R6。
8. 图谱与报告保持 Stage 3 行为。

目的: 保证旧 Agent、未配置 Agent 和 Stage 3 演示流程不发生视觉或行为回归。

### 4.2 Planner-Executor 流程

| 步骤 | 用户操作 | 页面即时反馈 | 达成目的 |
| --- | --- | --- | --- |
| 1 | 左侧点击“初始接口” | 加载当前 Agent Manifest 与已保存拓扑 | 明确操作对象 |
| 2 | 在“被测对象结构”中点击“规划-执行” | 右侧预览切换为 `外部输入 -> Planner -> Executor -> 工具/记忆` | 理解结构变化 |
| 3 | 点击预览中的 Planner | 检查器显示 `PLANNER`、internal、接收外部输入 | 确认规划节点职责 |
| 4 | 点击 Executor | 显示 `EXECUTOR` 及其可执行工具 | 确认执行权限 |
| 5 | 查看兼容性检查 | 缺少必要能力时显示具体缺项，不自动改 Manifest | 防止结构声明与能力声明矛盾 |
| 6 | 点击“保存并应用” | 先保存 Manifest，再应用 `planner_executor`；显示两段保存状态 | 建立可用拓扑和拓扑感知图谱 |
| 7 | 保存成功后进入“安全画像” | 第二列显示 Planner 与 Executor，`task_plan` 边标记为携带不可信内容 | 核验规划到执行的信任边界 |
| 8 | 点击“测评此拓扑” | 跳转“测评运行”，带入当前 Agent，默认筛选并推荐 R5 | 缩短测试路径 |
| 9 | 勾选推荐用例并启动 | 执行 `tc_r5_plan_001/002`，展示真实 SSE 状态 | 验证计划污染行为 |
| 10 | 点击“查看攻击图谱” | 默认聚焦 R5：恶意网页 -> Planner -> Executor -> 危险工具 | 理解风险传播链 |
| 11 | 点击 R5 节点或路径 | 右侧显示节点角色、边通道、测试用例与验证状态 | 定位风险责任点 |
| 12 | 进入“测评报告” | 显示 R5 覆盖、Finding、Evidence 和修复建议 | 判断计划隔离是否有效 |

最终用户结论应是：不只是“系统用了 Planner-Executor”，而是“Planner 接收的不可信内容是否会污染计划，并驱动 Executor 执行越权动作”。

### 4.3 RAG-Agent 流程

| 步骤 | 用户操作 | 页面即时反馈 | 达成目的 |
| --- | --- | --- | --- |
| 1 | 左侧点击“初始接口” | 加载当前 Agent 与拓扑 | 明确操作对象 |
| 2 | 点击“RAG-Agent” | 右侧预览切换为 `外部文档 -> Knowledge Base -> Retriever -> Agent -> 工具/记忆` | 理解检索链路 |
| 3 | 点击 Knowledge Base | 显示 external 信任边界、UNTRUSTED 标签和 retrieval 通道 | 识别知识库不是天然可信 |
| 4 | 点击 Retriever 或 Agent | 显示各节点角色和工具边界 | 区分检索与执行职责 |
| 5 | 查看兼容性检查 | 检查 Agent 是否具有实际测评所需工具和记忆能力 | 避免不可执行配置 |
| 6 | 点击“保存并应用” | 保存 Manifest，再应用 `rag_agent` | 生成拓扑感知图谱 |
| 7 | 进入“安全画像” | 第一列显示外部文档和知识库，第二列显示 Retriever 和主 Agent | 核验检索内容进入 Agent 的边界 |
| 8 | 点击“测评此拓扑” | 测评页默认筛选并推荐 R6 | 建立结构到用例的对应关系 |
| 9 | 启动推荐用例 | 执行 `tc_r6_rag_001/002` | 验证知识库投毒行为 |
| 10 | 查看攻击图谱 | 默认聚焦 R6：外部文档 -> 知识库 -> Retriever -> Agent -> 危险工具 | 查看完整传播路径 |
| 11 | 进入报告 | 显示 R6 覆盖、Finding、Evidence 和修复建议 | 判断检索隔离与输出控制是否有效 |

最终用户结论应是：不只是“系统连接了知识库”，而是“外部文档中的不可信指令能否经过摄入和检索进入 Agent 上下文，并触发危险动作”。

---

## 5. 页面级详细方案

### 5.1 主窗口与全局 Agent 上下文

### 目标

让七个工作区始终消费同一个当前 Agent 和当前拓扑，避免页面之间各自维护对象选择。

### 建议状态职责

`MainWindow` 继续拥有 `activeAgentId`。在其下增加统一的拓扑读取状态，概念上至少包含：

```text
activeAgentId
topology data
topology loading state
topology error state
topology refresh action
```

具体 TypeScript 类型必须来自更新后的 OpenAPI，不在前端手写公共数据结构。

### 状态刷新规则

1. `activeAgentId` 改变时，清除旧 evaluation session，并重新加载 topology。
2. 初始接口保存成功时，同时更新 `activeAgentId` 和 topology snapshot。
3. 切换侧边栏不重复 POST，只按需 GET。
4. topology GET 失败时显示“拓扑暂不可用”，页面按 `single` 兼容展示，但不得伪装成已确认的 single；应保留弱提示。

---

### 5.2 初始接口：选择、预览与应用拓扑

### 页面布局

保持当前左侧表单、中央分隔线、右侧预览的布局，不新增大面积卡片。

左侧表单顺序调整为：

```text
Agent ID / 名称 / 版本
被测对象结构
能力声明
数据源 / 记忆
工具权限
保存状态与操作按钮
```

“被测对象结构”采用紧凑分段选择器：

```text
[ 单 Agent ] [ 规划-执行 ] [ RAG-Agent ]
```

每个选项仅显示短名称；选中后在下方出现一行说明：

- 单 Agent：一个 Agent 直接读取数据、使用记忆和调用工具。
- 规划-执行：Planner 生成计划，Executor 执行任务，重点关注计划污染。
- RAG-Agent：外部文档经知识库与 Retriever 进入 Agent，重点关注上下文投毒。

### 右侧预览改造

右侧继续使用“后端画像预览”区域，内部顺序为：

1. 顶部工具栏：`Manifest / Profile / Graph` 加当前 topology 名称。
2. 紧凑拓扑预览：最多 5 个节点，使用与安全画像一致的节点符号。
3. 当前四项摘要：能力项、数据源、记忆、确认门。
4. 风险摘要：敏感工具、危险工具、持久存储、不可信源。
5. 拓扑兼容性检查。
6. JSON details：AgentManifest 与 AgentTopology 分成两个折叠项。

### 兼容性检查

兼容性检查只提示，不擅自修改用户 Manifest。

| 拓扑 | 检查内容 |
| --- | --- |
| single | Agent ID 和 Manifest 可提交 |
| planner_executor | 是否具备可供 Executor 调用的能力；是否存在用于 R5 的外部输入和危险动作 |
| rag_agent | 是否具备用于 R6 的危险动作或持久化能力；知识库能力如何接入由后端契约决定 |

提示分为：

- 已就绪：当前配置能够形成对应拓扑风险路径。
- 可保存但不可测：结构可以保存，但缺少 R5/R6 测评所需能力。
- 不可保存：Agent ID 或 Manifest 基础校验失败。

### 保存行为

用户选择拓扑时只更新本地草稿，不立即调用 POST。点击“保存并应用”后按固定顺序执行：

```text
1. POST /api/agents
2. POST /api/topology/{agent_id}
3. GET /api/agents/{agent_id}/graph 进行轻量可用性确认
4. 更新全局 activeAgentId 和 topology
5. 导航到“安全画像”
```

原因：当前后端 `POST topology` 会尝试重建图谱；若 Agent 尚未注册，图谱无法建立。

### 保存状态

| 状态 | 界面 |
| --- | --- |
| 未修改 | “保存并应用”可用 |
| Manifest 保存中 | 按钮显示“正在保存 Agent” |
| Topology 应用中 | 按钮显示“正在应用拓扑” |
| 全部成功 | 短暂显示“拓扑已应用”，随后进入安全画像 |
| Manifest 失败 | 保留所有草稿，显示后端错误，不调用 topology POST |
| Topology 失败 | 明确显示“Agent 已保存，拓扑未应用”，提供“重试应用拓扑” |
| Graph 确认失败 | 配置仍视为已保存，提示图谱暂不可用，可重试读取 |

不要继续使用含义模糊的“保存并重启”。建议改为“保存并应用”。

---

### 5.3 安全画像：把拓扑融入现有能力边界图

### 页面职责

安全画像回答“哪些组件接触了哪些数据、拥有哪些工具、跨越了什么信任边界”，不负责展示测评证据。

### 数据来源

根据同一个 `activeAgentId` 并行加载：

```text
GET /api/agents/{agent_id}
GET /api/agents/{agent_id}/graph
GET /api/topology/{agent_id}
```

使用 Profile 提供能力和安全资产，Topology 提供逻辑角色，AttackGraph 提供实际安全节点和边。不得继续固定传入 `securityProfileFixtureViewModel`。

### 头部

标题保持：`{Agent name} 的能力边界`。

权限数字摘要继续位于右上。标题下新增一条紧凑状态：

```text
Planner-Executor · 2 个逻辑节点 · 1 条不可信通道
```

该状态不是按钮，也不做大卡片。

### 四列画布映射

保留当前四列和右侧检查器，避免重做页面骨架。

| 列 | single | planner_executor | rag_agent |
| --- | --- | --- | --- |
| 输入与数据入口 | 网页内容、邮件数据 | 网页内容、邮件数据 | 外部文档、Knowledge Base、其他数据源 |
| Agent 执行核心 | 主 Agent | Planner、Executor | Retriever、主 Agent |
| 持久状态 | 长期记忆 | 长期记忆 | 长期记忆 |
| 工具与外发 | 读取邮件、发送邮件等 | Executor 可调用工具 | 主 Agent 可调用工具 |

### 节点表达

- `PLANNER`：机器人图标，标题“任务规划”，副标题 `PLANNER`。
- `EXECUTOR`：机器人图标，标题“任务执行”，副标题 `EXECUTOR`。
- `RETRIEVER`：搜索或检索图标，标题“上下文检索”，副标题 `RETRIEVER`。
- `KNOWLEDGE_BASE`：数据库图标，标题“知识库”，副标题 `EXTERNAL / UNTRUSTED`。
- 主 Agent：沿用当前主体节点样式。

不要仅依赖颜色区分角色；必须同时使用图标、标题和副标题。

### 边表达

- 普通数据流：沿用低透明度蓝紫线。
- `carries_untrusted_content=true`：提高线条对比度，并在线条附近显示短标签 `不可信内容`。
- `task_plan`：显示 `TASK PLAN`。
- `retrieval`：显示 `RETRIEVAL`。
- 危险工具方向仍用现有危险节点色表达，不额外把整张图染红。

### 点击检查器

点击节点后，右侧检查器显示：

```text
节点名称
角色 role
信任边界 trust_boundary
安全标签 labels
可用工具 tools
进入该节点的不可信通道
流向下游的节点
数据依据：Profile / Topology / AttackGraph
```

### 页面动作

底部原“查看防御机制”入口保留。新增“测评此拓扑”作为次级命令，跳转到运行页并写入 topology handoff：

```text
agent_id
recommended_risk_pattern: R5 | R6 | null
```

若该 handoff 字段需要跨模块持久化并成为公共语义，必须先确认其归属；前端可以先通过现有应用内状态传递，不写入 wire contract。

---

### 5.4 测评运行：围绕当前拓扑推荐用例

### 页面职责

测评运行不负责再次配置拓扑，只负责明确“当前测谁、为什么推荐这些用例、执行到哪里”。

### 头部

右上角 Agent Badge 改为：

```text
CorpMate v0 · Planner-Executor
```

拓扑信息读取失败时仅显示 Agent，不显示猜测结果。

### 对象选择调整

当前 Agent 来自 `activeAgentId`。现有 Bare、Defended、Comparison 选择需要与拓扑测评拆开：

- 单体测评：固定显示当前 Agent。
- Bare vs Defended：保留为独立“测评模式”选项，不伪装成 Agent 拓扑选择。
- 若对比模式仅支持固定 Agent，应在进入时明确提示它不会使用当前自定义拓扑。

### 风险筛选

风险筛选不再用前端常量作为唯一事实来源，而是从 `/api/test-cases` 返回的 `target_risk_pattern` 去重生成，并结合 topology 标记适配性。

| 当前拓扑 | 默认筛选 | 推荐 | 不兼容提示 |
| --- | --- | --- | --- |
| single | 全部基础路径 | R1-R4 | R5/R6 不进入推荐 |
| planner_executor | R5 | R5 + 仍可执行的 R1-R4 | R6 标记“需要 RAG-Agent” |
| rag_agent | R6 | R6 + 仍可执行的 R1-R4 | R5 标记“需要 Planner-Executor” |

下拉项文案：

```text
全部适配路径
R1 间接提示注入
R2 记忆污染
R3 敏感数据外泄
R4 持久间接提示注入
R5 计划污染 · 适配规划-执行
R6 RAG 上下文投毒 · 适配 RAG-Agent
```

### 推荐用例

从安全画像进入时：

1. 自动应用 R5 或 R6 筛选。
2. 推荐用例行增加小型 `推荐` 标记。
3. 不自动开始运行。
4. 是否自动勾选推荐用例由三人确认；建议默认勾选 2 条拓扑专属用例，用户仍可取消。

### 运行状态

在后端没有提供节点级事件语义前，运行页只展示现有真实 SSE 事件，不凭 topology 推断“Planner 已处理”或“Retriever 已检索”。

如未来确认事件 payload 中增加节点信息，才增加以下显示：

```text
Planner 接收输入
Planner 生成 task_plan
Executor 接收计划
Executor 调用 email.send
```

否则，节点级传播只在 AttackGraph 的结构层展示，Finding 仍由 Judge 决定。

### 运行完成动作

运行完成后提供两个明确动作：

- “查看攻击图谱”：携带当前 Agent、evaluation ID 和优先路径 R5/R6。
- “查看测评报告”：进入当前 evaluation 的报告。

---

### 5.5 攻击图谱：显示结构风险与验证状态

### 页面职责

攻击图谱回答“风险沿哪些节点和边传播”，并区分：

- 待验证：AttackGraph 命中了 RiskPattern，但当前报告没有对应 Finding。
- 已验证：当前 evaluation report 中存在同 `risk_pattern_id` 的 Finding。

### 数据加载

基础数据：

```text
GET /api/agents/{agent_id}/graph
GET /api/topology/{agent_id}
```

若当前 evaluation session 有可用 report：

```text
GET /api/evaluations/{evaluation_id}/report
```

当前后端没有“按 Agent 获取最近报告”的接口，因此用户直接从侧边栏进入图谱时可以只展示潜在路径；从运行或报告进入时，使用已有 evaluation session 合并验证状态。

### 画布布局

保留左侧大图、下方路径选择、右侧检查器。画布使用最多五个语义位置，不按固定节点类型写死：

```text
01 风险入口
02 内容处理
03 状态或交接
04 决策执行
05 危险动作
```

路径映射示例：

| 路径 | 01 | 02 | 03 | 04 | 05 |
| --- | --- | --- | --- | --- | --- |
| R4 | 恶意网页 | Agent 解析 | 长期记忆 | Agent 唤起 | 邮件发送 |
| R5 | 恶意网页 | Planner | task_plan | Executor | 危险工具 |
| R6 | 外部文档 | Knowledge Base | Retriever | 主 Agent | 危险工具 |

不是每条路径都必须填满五格；短路径保持居中和稳定尺寸，不通过放大节点填充空间。

### 路径构造

前端不再使用“找到第一个 AGENT 节点”的方法。应依据：

1. `risk_pattern_id`
2. `AttackGraph.risk_path_ids`
3. 节点 `node_type`
4. 节点 `metadata.role`
5. 边的 `source_node_id`、`target_node_id`、`edge_type`

R5 和 R6 若暂时没有正式 `AttackPath` API，可在已确认契约允许的范围内，从当前 AttackGraph 中选择符合既定角色序列的节点。不得创造新的 wire 字段或字段别名。

### 路径卡片

路径卡片继续使用现有布局，新增：

```text
R5  Plan Contamination                 待验证 / 已验证
R6  RAG Context Poisoning              待验证 / 已验证
```

顺序建议：已验证路径优先，其次当前拓扑专属路径，再显示 R1-R4。

### 右侧检查器

路径模式显示：

- 路径名称、严重等级、状态。
- 当前拓扑与适用原因。
- 路径故事。
- TestCase、AttackSeed 和预期行为。
- 已验证时显示 Finding Evidence。
- 待验证时显示“验证此路径”按钮并跳转测评运行。

节点模式显示：

- 节点名称、类型、角色、安全标签。
- 入边与出边。
- `channel` 与 `carries_untrusted_content`。
- 该节点参与的风险路径。

---

### 5.6 测评报告：按 Finding 展示动态拓扑证据

### 页面职责

报告只陈述本次 evaluation 已产生的事实，不根据 topology 自动生成 Finding。

### 数据加载

报告加载成功后，以 `report.agent_id` 查询：

```text
GET /api/topology/{report.agent_id}
```

Topology 查询失败不阻塞报告主体；标题区显示“拓扑信息暂不可用”。

### 头部

保留 Agent Badge、严重等级和返回运行按钮。Agent Badge 下增加拓扑摘要：

```text
Planner-Executor · R5 适配
```

### 风险覆盖

使用 `report.summary.by_risk_pattern` 展示真实运行覆盖，不按拓扑类型伪造分母。

建议分为两行：

```text
基础风险 R1-R4    已测 4 类 / 通过 3 / 失败 1
拓扑风险 R5-R6    已测 1 类 / 通过 0 / 失败 1
```

如果本次只运行 R5，则显示 R5 的真实结果，不写“R5-R6 2/2 已覆盖”。

### Finding 列表

Finding 主标题优先显示人读名称，副信息保留契约值：

```text
计划污染
HIGH · R5 · plan_contamination
```

R6 同理。

### Evidence 详情

移除固定 R4 五节点常量。证据路径应按 `finding.risk_pattern_id` 和 Trace 构造：

- R5：不可信输入 -> Planner -> task_plan -> Executor -> 危险动作。
- R6：外部文档 -> Knowledge Base -> Retriever -> Agent -> 危险动作。
- R1-R4 保持当前对应路径。

没有直接证据支持的节点使用“结构关联”样式；Evidence event 能支持的步骤使用“证据确认”样式。两者必须视觉区分，避免把架构推断冒充运行证据。

### 报告动作

- “在攻击图谱中定位”：进入图谱并选中该 `risk_pattern_id`。
- “返回运行”：沿用现有动作。
- 防御建议继续使用 Finding 的 `remediation`，没有返回时才使用明确标注的通用建议。

---

### 5.7 总览：只承担摘要和入口

原计划没有覆盖总览，但当前 Agent 保存后会回到总览，因此总览必须能接住拓扑状态。

### 调整内容

1. “智能体侧写”区域新增拓扑标签，例如 `Planner-Executor`。
2. 能力摘要增加节点数，不增加完整拓扑图。
3. 若图谱命中 R5/R6，主风险标题可以显示当前最高优先级拓扑风险。
4. 若尚未运行拓扑用例，显示“发现潜在 R5，尚未验证”。
5. “进入攻击图谱”保持主动作；旁边可提供“开始拓扑测评”。

总览不重复安全画像和攻击图谱的详细内容。

---

## 6. 接口与数据流方案

### 6.1 BFF 路由

前端新增薄代理：

| 方法 | 浏览器路由 | 上游路由 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/topology/presets` | `GET /topology/presets` | 获取可用预设摘要 |
| GET | `/api/topology/[agentId]` | `GET /topology/{agent_id}` | 获取当前 Agent 拓扑 |
| POST | `/api/topology/[agentId]` | `POST /topology/{agent_id}` | 应用预设拓扑 |

BFF 继续遵守现有规则：浏览器只访问同源 `/api/*`，后端地址不暴露到客户端，错误转换为统一 `{ error: { code, message, details } }`。

### 6.2 预期调用序列

### 进入初始接口

```text
GET /api/agents/{agent_id}
GET /api/topology/presets
GET /api/topology/{agent_id}
```

### 保存并应用

```text
POST /api/agents
  成功 -> POST /api/topology/{agent_id} { preset_name }
          成功 -> GET /api/agents/{agent_id}/graph
```

### 进入安全画像

```text
GET /api/agents/{agent_id}
GET /api/topology/{agent_id}
GET /api/agents/{agent_id}/graph
```

### 进入攻击图谱

```text
GET /api/agents/{agent_id}/graph
GET /api/topology/{agent_id}
GET /api/evaluations/{evaluation_id}/report  # 仅当前会话有 evaluation ID 时
```

### 进入报告

```text
GET /api/evaluations/{evaluation_id}/report
GET /api/evaluations/{evaluation_id}/trace
GET /api/topology/{report.agent_id}
```

### 6.3 数据真实性分级

| 层级 | 来源 | 页面文案 |
| --- | --- | --- |
| 配置事实 | Topology API | “当前拓扑” |
| 结构推导 | AttackGraph + RiskPattern | “潜在风险路径” |
| 运行事实 | ExecutionEvent / Trace | “执行事件” |
| 风险结论 | RiskFinding | “已验证风险” |

任何页面都不得跨级使用文案。例如仅有 R5 `risk_path_ids` 时只能显示“潜在 R5”，不能显示“已发生计划污染”。

---

## 7. Contract 与后端前置条件

以下事项不属于胡继天单独修改前端即可完成的内容，必须在实施前由对应 Owner 确认。

### P0-1 AgentTopology 契约归位

当前后端已有本地 Pydantic 模型，但主契约目录和前端 OpenAPI 尚未形成一致事实来源。需要：

1. 三人确认 AgentTopology 相关模型是否成为正式公共契约。
2. 先更新 `csy——全智赛/shared/contracts/`。
3. 同步 `CODING_AGENT_RULE.md` 中枚举和节点类型。
4. 更新后端 OpenAPI。
5. 重新生成前端 `backend-api.d.ts`。

### P0-2 R5/R6 TestCase 可加载、可执行

当前文件：

```text
test_cases_r5.json
test_cases_r6.json
```

当前 Loader 只匹配：

```text
security_testcases*.json
```

此外，现有 R5/R6 文件中的 `scenario.turns`、`success_criteria`、`expected_behavior` 等字段与正式 TestCase 契约不一致。需要：

1. 按正式 TestCase schema 重写或生成 R5/R6 用例。
2. 使用 Loader 能发现的正式文件名。
3. 通过 schema 校验和后端加载测试。
4. 确认 `/test-cases` 能返回 R5/R6 摘要。
5. 确认 evaluation service 能真正执行并产出 R5/R6 ReportSummary。

### P0-3 RAG 环境增量

R6 草案使用 `knowledge_base_docs`，但当前公开 `EnvDelta` 契约只有浏览器、记忆和邮件相关字段。不得由前端或后端私自加入。需要单独提交契约变更单，或由 Owner 决定使用现有字段表达可执行的 R6 场景。

### P0-4 运行时证据边界

当前 Stage 4 后端目标明确“不实现真正多 Agent Runtime”。因此需要三人确认：

- R5/R6 仅做结构建模和静态图谱匹配；还是
- Runner/Judge 能生成足够的运行事件与 Finding，支持“已验证”展示。

若只能做前者，前端必须把 R5/R6 标记为“潜在路径”，不得在报告中伪造验证结果。

### P0-5 拓扑持久化

当前拓扑使用进程内存储。需要确认比赛演示是否接受：

- 浏览器刷新不丢失，只要后端进程未重启；
- 后端重启后拓扑恢复为 `single`。

若不接受，应由后端 Owner 增加持久化；前端不使用 localStorage 冒充服务端已保存状态。

---

## 8. 视觉与交互规范

### 8.1 视觉方向

延续当前 AgentProof 的“轻量工程蓝图工作台”：浅色背景、细网格、克制边框、倾斜展示字体、蓝色主操作、按安全语义加入少量辅助色。

不新增营销式 Hero、大圆角卡片、悬浮岛、装饰性渐变球或与现有页面无关的深色赛博主题。

### 8.2 颜色语义

| 语义 | 建议 |
| --- | --- |
| 当前选择 / 主路径 | 现有 AgentProof 蓝 |
| 可信内部节点 | 蓝绿辅助色 |
| 持久状态 | 现有记忆橙色 |
| 危险工具 / 已验证高危 | 红色，仅用于风险强调 |
| 不可信传输 | 紫色线或紫色标签，不铺满整块背景 |
| 不可用 / 未适配 | 中性灰 |

颜色必须与文字、图标和标签共同表达状态，不能只靠颜色。

### 8.3 尺寸与响应式

1. 1920x1080 答辩视口是主要验收尺寸。
2. 保持侧边栏展开和收起两种布局稳定。
3. 节点使用固定宽高与响应式画布坐标，文字不得改变节点尺寸。
4. RAG 五节点路径在 1366px 宽度下仍不得与右侧检查器重叠。
5. 窄屏优先允许画布内部横向滚动，不把节点压缩到文字溢出。

### 8.4 动效

- 拓扑预览切换：旧节点淡出，新节点按数据流方向依次出现，总时长控制在 400-600ms。
- 安全画像：沿用现有 GSAP reveal，新增节点不另做循环动画。
- 攻击图谱：选中 R5/R6 时沿路径绘制一次，不持续闪烁。
- SSE：只对新事件做短暂强调。
- 完整支持 `prefers-reduced-motion`。

---

## 9. 建议文件与模块划分

以下名称是前端内部实施建议，不是公共 Contract 名称；胡继天可按现有目录习惯调整。

```text
apps/main-platform/app/
├── api/topology/
│   ├── presets/route.ts
│   └── [agentId]/route.ts
│
├── windows/main/
│   ├── agent/
│   │   ├── AgentInterfaceWorkspace.tsx
│   │   ├── AgentTopologySelector.tsx
│   │   ├── AgentTopologyPreview.tsx
│   │   └── topology-compatibility.ts
│   │
│   ├── profile/
│   │   ├── SecurityProfileGraph.tsx
│   │   ├── security-profile-repository.ts
│   │   └── security-profile-data.ts
│   │
│   ├── anatomy/
│   │   ├── AnatomyGraph.tsx
│   │   ├── anatomy-data.ts
│   │   ├── anatomy-graph-layout.ts
│   │   └── anatomy-repository.ts
│   │
│   └── evaluation/
│       ├── EvaluationWorkspaceProvider.tsx
│       ├── TestCaseSelector.tsx
│       ├── EvaluationRunWorkspace.tsx
│       └── EvaluationReportWorkspace.tsx
│
└── lib/contracts/
    ├── backend-openapi.json
    └── backend-api.d.ts
```

不要新建 `windows/main/run/` 或 `windows/main/report/`。当前运行与报告实际都位于 `windows/main/evaluation/`，原计划中的目录描述需要修正。

---

## 10. 实施拆分

### Phase 0 - 契约与后端可用性确认

Owner: 陈书扬 + 步嘉城；胡继天参与对接。

- [ ] AgentTopology 是否进入正式 contracts 已确认。
- [ ] NodeType、RiskType、RiskPattern 扩展已走变更流程。
- [ ] OpenAPI 包含 topology 路由和模型。
- [ ] R5/R6 TestCase 通过正式 schema。
- [ ] `/test-cases` 返回 R5/R6。
- [ ] R5/R6 能否生成真实 Finding 已明确。
- [ ] 拓扑内存存储限制已确认。

Phase 0 未完成前，只进行页面静态原型，不合入正式数据消费代码。

### Phase 1 - 前端数据基础

Owner: 胡继天。

- [ ] 新增三条 topology BFF 路由及 route tests。
- [ ] 更新 OpenAPI 并生成类型。
- [ ] 建立当前 Agent 的 topology 读取与刷新机制。
- [ ] 让 Evaluation Provider 真正使用 `activeAgentId`。
- [ ] 定义 loading、not-found、unavailable、partial-save 状态。

验收产物：任意页面都能显示同一个当前 Agent 和真实 topology，切换 Agent 后不会残留旧状态。

### Phase 2 - 初始接口闭环

Owner: 胡继天。

- [ ] 增加三段式 topology selector。
- [ ] 增加右侧即时拓扑预览。
- [ ] 增加能力兼容性检查。
- [ ] 实现 Manifest -> Topology -> Graph 的顺序保存。
- [ ] 实现 topology 单独重试。
- [ ] 保存成功后导航安全画像。

验收产物：用户能从零完成 Planner-Executor 和 RAG-Agent 的选择、预览、保存与回显。

### Phase 3 - 画像与图谱

Owner: 胡继天，步嘉城确认 Graph 数据。

- [ ] 安全画像由真实数据构建，不再固定使用 fixture。
- [ ] 三种 topology 映射到现有四列画布。
- [ ] 检查器展示 role、trust boundary、tools 和不可信边。
- [ ] Anatomy 支持 KNOWLEDGE_BASE 和多 AGENT 角色。
- [ ] R5/R6 路径卡片、动态阶段和验证动作可用。
- [ ] 图谱能够合并当前 report 的 Finding 状态。

验收产物：用户可以从结构核验进入风险路径，不出现重复拓扑图或错误 Agent 节点。

### Phase 4 - 测评与报告闭环

Owner: 胡继天；陈书扬确认 R5/R6 风险文案与证据语义。

- [ ] TestCase 筛选支持 R1-R6。
- [ ] 当前 topology 决定默认筛选和推荐用例。
- [ ] 当前 Agent 与测评对象一致。
- [ ] 运行完成可进入选中的 R5/R6 图谱和报告。
- [ ] 报告显示 topology、真实覆盖和动态 Evidence 路径。
- [ ] 总览显示轻量 topology 摘要。

验收产物：两种非 single topology 都能完成从配置到报告的全流程演示。

### Phase 5 - 回归与答辩演练

- [ ] Single Agent 全流程与 Stage 3 一致。
- [ ] Planner-Executor 标准演示路径通过。
- [ ] RAG-Agent 标准演示路径通过。
- [ ] 后端不可用、拓扑丢失、用例为空等异常状态通过。
- [ ] 1920x1080、1366x768 和侧边栏收起状态完成截图检查。
- [ ] 键盘操作、焦点状态和 reduced motion 通过。

---

## 11. 测试计划

### 11.1 单元测试

- topology 兼容性判断。
- topology 到画像节点的映射。
- R5/R6 路径步骤构造。
- topology 到推荐 RiskPattern 的映射。
- Finding 与路径验证状态合并。
- 报告覆盖统计显示。

### 11.2 Repository 与 BFF 测试

- presets GET 成功与错误透传。
- agent topology GET 默认 single。
- topology POST 请求体保持 `snake_case`。
- Profile、Graph、Topology 部分失败时的降级。
- 报告不存在时图谱保持 potential。

### 11.3 结构测试

- Profile 不再固定消费 fixture。
- Evaluation Provider 不再丢弃 `activeAgentId`。
- TestCase 风险筛选不再硬编码只到 R4。
- Anatomy 不再只选择第一个 AGENT 节点。
- Report Evidence 不再固定使用 R4 节点数组。

### 11.4 E2E 场景

#### E2E-01 Planner-Executor

```text
进入初始接口
-> 选择规划-执行
-> 保存并应用
-> 安全画像出现 Planner/Executor
-> 点击测评此拓扑
-> 默认出现 R5 推荐用例
-> 启动测评
-> 查看 R5 图谱
-> 查看包含 R5 覆盖的报告
```

#### E2E-02 RAG-Agent

```text
进入初始接口
-> 选择 RAG-Agent
-> 保存并应用
-> 安全画像出现 Knowledge Base/Retriever/Main Agent
-> 点击测评此拓扑
-> 默认出现 R6 推荐用例
-> 启动测评
-> 查看 R6 图谱
-> 查看包含 R6 覆盖的报告
```

#### E2E-03 Single 回归

```text
选择单 Agent
-> 保存并应用
-> 安全画像保持现有布局
-> 测评页默认 R1-R4
-> 图谱和报告不出现错误的 R5/R6 已验证状态
```

#### E2E-04 部分保存失败

```text
Manifest 保存成功
-> Topology POST 失败
-> 页面不丢失草稿
-> 明确显示 Agent 已保存、Topology 未应用
-> 点击重试
-> 成功后进入安全画像
```

---

## 12. Definition of Done

### 数据闭环

- [ ] 当前 Agent 在初始接口、总览、画像、运行、图谱和报告中一致。
- [ ] Topology 读取、应用和错误状态均来自真实 BFF。
- [ ] 前端类型来自 contracts/OpenAPI，不存在平行手写类型。
- [ ] R5/R6 TestCase 能被 `/api/test-cases` 返回并被 evaluation 执行。

### 用户闭环

- [ ] 用户能按本文步骤完成 Planner-Executor 全流程。
- [ ] 用户能按本文步骤完成 RAG-Agent 全流程。
- [ ] 保存后无需刷新页面即可看到新拓扑。
- [ ] 从画像进入测评时自动带入正确 Agent 和推荐路径。
- [ ] 从运行进入图谱或报告时保留当前 evaluation 上下文。

### 表达正确性

- [ ] 安全画像表达能力和边界，不冒充运行证据。
- [ ] AttackGraph 命中但无 Finding 时显示“待验证”。
- [ ] 只有 RiskFinding 支持的路径显示“已验证”。
- [ ] R5/R6 Evidence 路径不复用错误的 R4 固定模板。
- [ ] 报告覆盖率来自实际 ReportSummary，不按 topology 推测。

### 视觉与可用性

- [ ] 新界面与现有 AgentProof 工作台一致。
- [ ] 不新增工作区、不新增第三方图形库。
- [ ] 1920x1080 与 1366x768 无重叠、截断和不可操作控件。
- [ ] 侧边栏展开/收起后图谱稳定。
- [ ] 键盘、焦点、ARIA 和 reduced motion 可用。

---

## 13. 待三人确认清单

以下问题确认前不得由 Coding Agent 擅自决定：

1. AgentTopology 是否正式加入 `shared/contracts/`，具体 schema 以哪份文件为准？
2. `KNOWLEDGE_BASE` 是否正式加入冻结 NodeType 枚举？
3. `plan_contamination`、`rag_context_poisoning` 是否正式加入风险类型枚举？
4. R6 的 `knowledge_base_docs` 是否进入 EnvDelta 契约，还是使用现有环境字段表达？
5. R5/R6 是只做结构匹配，还是本阶段必须由 Runner/Judge 产出真实 Finding？
6. 从画像进入测评时，是否默认勾选两条推荐用例？
7. 自定义拓扑 Agent 是否参与 Bare vs Defended 对比，还是对比模式继续固定两个系统 Agent？
8. 后端重启后 topology 丢失是否可接受？
9. 保存成功后默认进入安全画像，还是继续进入总览？本方案推荐进入安全画像。

---

## 14. 工作量估算

以下只估算前端与 BFF，不包含 Contract、R5/R6 TestCase、Runner/Judge 和后端持久化改造。

| 工作项 | 估算 |
| --- | ---: |
| BFF、生成类型、全局 topology 状态 | 1 天 |
| 初始接口选择器、预览、保存状态 | 1-1.5 天 |
| 安全画像真实数据化与三拓扑布局 | 1.5-2 天 |
| 攻击图谱 R5/R6 与动态路径 | 1.5-2 天 |
| 测评筛选、handoff、报告与总览 | 1.5-2 天 |
| 单测、结构测试、E2E、响应式修正 | 1.5-2 天 |
| **前端合计** | **8-10.5 人天** |

原计划的 2.5-3.5 天只够完成静态增量展示，无法完成真实 Agent 上下文、部分失败处理、R5/R6 测评闭环和多页面回归。本方案建议按 8-10.5 人天安排，并在 Phase 0 完成后再锁定最终排期。

---

## 15. 答辩演示建议

### 演示 A：Planner-Executor

```text
初始接口选择规划-执行
-> 指出 task_plan 不可信通道
-> 保存并进入安全画像核对 Planner/Executor 权限
-> 一键进入 R5 测评
-> 运行计划污染用例
-> 攻击图谱定位传播路径
-> 报告展示 Finding 与 Evidence
```

讲解重点：职责分离本身不等于安全；如果 Planner 的污染计划未经校验传给 Executor，危险动作仍会执行。

### 演示 B：RAG-Agent

```text
初始接口选择 RAG-Agent
-> 指出 Knowledge Base 的 external/UNTRUSTED 边界
-> 安全画像核对 Retriever 到 Agent 的 retrieval 通道
-> 一键进入 R6 测评
-> 运行知识库投毒用例
-> 图谱展示外部文档到危险工具的完整链
-> 报告展示覆盖与证据
```

讲解重点：知识库不是可信内容仓库；外部文档被索引后，隐藏指令可能在之后的检索中重新进入 Agent 上下文。

---

*本 V2 方案的判断标准不是“页面上出现了 topology”或“下拉框增加了 R5/R6”，而是用户能否从一个明确的当前 Agent 出发，完成结构配置、边界核验、专属测评、路径定位和证据确认的完整闭环。*
