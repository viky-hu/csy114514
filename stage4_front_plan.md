# Stage 4 Frontend Topology Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Every task must finish with its focused tests and a reviewable working state before the next task begins.

**Date:** 2026-09-08

**Goal:** 在现有 AgentProof 前端中加入 Agent 拓扑选择、拓扑展示以及 R5/R6 拓扑风险展示，同时保证 `single` 拓扑下的 Stage 3 行为和视觉结构不变。

**Architecture:** 新增一个位于 `app/windows/main/topology/` 的前端拓扑模块，集中维护 snake_case wire 类型、预设文案、加载/保存 repository 和 fallback 行为。浏览器只通过 `app/api/topology/**` 的同源 BFF 访问后端；Agent、Security Profile、Anatomy、Evaluation Run、Evaluation Report 只消费这个模块输出的数据。现有 AgentManifest、Evaluation SSE 归约、RiskPattern 语义和 `shared/contracts/` 保持不变。

**Tech Stack:** Next.js App Router, React function components, TypeScript, project-owned CSS, Tailwind CSS v4 as already configured, `lucide-react`, existing GSAP/useGSAP motion, Node test runner, Playwright.

## Global Constraints

- 不修改后端代码；后端拓扑 API 只作为已存在的上游依赖。
- 不修改 `shared/contracts/`、`backend-openapi.json`、生成的 `backend-api.d.ts` 或 `evaluation-types.ts` 的冻结事件契约。
- 不修改 SSE `parseEvent()`、`reduceEvaluationEvent()`、`BatchProgressPanel`、`EvaluationTerminal` 和 `evaluation-session.ts` 的语义。
- 不修改红队演练工作区和 Stage 3 核心逻辑；只做拓扑信息的增量展示和筛选。
- 不引入 D3、ECharts、Recharts、vis.js 或任何第三方图表库；拓扑图使用现有 SVG、HTML、CSS 和 lucide 图标。
- wire 字段保持 `snake_case`：`topology_type`、`trust_boundary`、`from_node`、`to_node`、`carries_untrusted_content`、`preset_name`。
- `single` 是默认值；读取失败或 Agent 尚未设置拓扑时，前端回退为 `single`，并保留当前 Stage 3 视觉与交互。
- 所有新增页面状态都必须支持加载、保存中、失败、回退和 reduced-motion 状态；流程不得要求刷新页面。
- 行为或模块边界变化完成后，必须更新 `docs/architecture/modules-index.md` 和 `docs/architecture/extension-review-checklist.md`。

---

## Task 1: 建立拓扑前端数据边界与 BFF

**目的：** 先让前端拥有稳定的拓扑 wire 数据入口，后续页面不直接拼接 fetch URL，也不各自定义一套类型。

**Files:**
- Create: `apps/main-platform/app/windows/main/topology/topology-types.ts`
- Create: `apps/main-platform/app/windows/main/topology/topology-labels.ts`
- Create: `apps/main-platform/app/windows/main/topology/topology-repository.ts`
- Create: `apps/main-platform/app/api/topology/presets/route.ts`
- Create: `apps/main-platform/app/api/topology/[agentId]/route.ts`
- Create: `apps/main-platform/app/api/topology/topology-bff-structure.test.mjs`
- Create: `apps/main-platform/app/windows/main/topology/topology-repository.test.ts`

**Interfaces:**

`topology-types.ts` 必须导出：

```ts
export const TOPOLOGY_TYPES = [
  "single",
  "planner_executor",
  "rag_agent",
] as const;

export type TopologyType = (typeof TOPOLOGY_TYPES)[number];

export type TopologyNode = {
  id: string;
  role: string;
  trust_boundary: string;
  tools: string[];
};

export type TopologyEdge = {
  from_node: string;
  to_node: string;
  channel: string;
  carries_untrusted_content: boolean;
};

export type AgentTopology = {
  agent_id: string;
  topology_type: TopologyType;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
};

export type TopologyPresetSummary = {
  topology_type: TopologyType;
  description: string;
  node_count: number;
  edge_count: number;
};

export type SetTopologyRequest = {
  preset_name: TopologyType;
};
```

`topology-repository.ts` 必须导出可注入 fetcher 的 repository：

```ts
export type TopologyLoadResult = {
  source: "api" | "fallback";
  topology: AgentTopology;
  errorMessage?: string;
};

export interface TopologyRepository {
  loadPresets(): Promise<TopologyPresetSummary[]>;
  loadAgentTopology(agentId: string): Promise<TopologyLoadResult>;
  saveAgentTopology(agentId: string, presetName: TopologyType): Promise<AgentTopology>;
}
```

`topology-labels.ts` 只放展示元数据，不改变 wire 值：中文名称、英文名称、描述、角色名、风险类型名和 `single`/拓扑风险分组。

- [ ] **Step 1: 定义类型和展示元数据**

  只新增上述本地类型，不把拓扑字段并入 `AgentManifest` 或生成的 OpenAPI 类型。所有页面使用 `topology_type` 等原始字段，展示文案通过 label map 转换。

- [ ] **Step 2: 实现 repository 和 fallback**

  `loadPresets()` 请求 `/api/topology/presets`；请求失败时返回三个内置预设摘要，使接入页仍然可操作。`loadAgentTopology()` 请求 `/api/topology/{encodedAgentId}`；请求失败或 payload 不合法时返回 `single` fallback 和错误文案。`saveAgentTopology()` POST：

  ```json
  { "preset_name": "planner_executor" }
  ```

  保存失败必须抛出可显示的错误，不静默变成成功。

- [ ] **Step 3: 实现三个 BFF 方法**

  - `GET /api/topology/presets` 转发到上游 `GET /topology/presets`。
  - `GET /api/topology/[agentId]` 转发到上游 `GET /topology/{agent_id}`，路径参数必须 `encodeURIComponent`。
  - `POST /api/topology/[agentId]` 转发请求 body 到上游 `POST /topology/{agent_id}`，保留 `Content-Type`、`Accept`、`request.signal` 和现有 `{ error: { code, message, details } }` 不可用响应习惯。

  路由 `runtime` 使用 `nodejs`，上游地址只能通过现有 server-side backend helper 生成。

- [ ] **Step 4: 写测试并运行**

  BFF 测试覆盖：静态 `/presets` 路由优先级、Agent ID 编码、GET/POST 方法、POST body、上游 status 透传、网络失败响应。repository 测试覆盖：合法 payload、非法 payload、single fallback、预设 fallback、保存 body。

  Run:

  ```text
  node --test apps/main-platform/app/api/topology/topology-bff-structure.test.mjs
  node --experimental-strip-types --test apps/main-platform/app/windows/main/topology/topology-repository.test.ts
  ```

- [ ] **Step 5: Commit**

  ```text
  git add apps/main-platform/app/windows/main/topology apps/main-platform/app/api/topology
  git commit -m "feat: add frontend topology data boundary"
  ```

**完成标准：** 页面层只需要调用 topology repository；三条同源 BFF 路由可被独立测试；后端不可用时默认仍得到 `single`。

---

## Task 2: 在 Agent 接入页加入拓扑选择与保存

**目的：** 用户在已有 Agent Manifest 表单中选择三种结构，并在一次保存流程中先保存 Agent，再保存拓扑。

**Files:**
- Modify: `apps/main-platform/app/windows/main/agent/AgentInterfaceWorkspace.tsx`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Create: `apps/main-platform/app/windows/main/agent/agent-topology-form.test.mjs`

**Interfaces:**
- Consumes: `defaultTopologyRepository`, `TopologyPresetSummary`, `TopologyType`。
- Produces: 成功后调用现有 `onAgentSaved(manifest.agent_id)`；不得改变 `AgentManifest` wire shape。

- [ ] **Step 1: 在组件状态中增加独立 topology state**

  增加：`topologyType: TopologyType`、`topologyPresets`、`topologyStatus`、`topologyError`。拓扑选择必须独立于 `AgentDraftState`，因为 AgentManifest 是冻结的后端契约。

- [ ] **Step 2: 页面加载时并行读取 Agent 和拓扑**

  继续使用现有 `/api/agents/{agentId}` 读取 Manifest，同时调用 `loadAgentTopology(activeAgentId)`。两者都完成后填充表单；拓扑读取失败时显示可理解的非阻塞提示并选择 `single`。切换 `activeAgentId` 时用 `AbortController` 清理旧请求。

- [ ] **Step 3: 在 AgentConnectDraft 之后增加拓扑选择区**

  在现有表单预览和 footer 之间插入 `.agent-topology-section`。使用原生 radio group，每个选项显示中文名称、英文 key、描述和 `node_count`/`edge_count`。选择时立即更新本地状态，不调用后端；保留键盘操作和 visible focus。

  选项固定为：

  ```text
  single             单 Agent 多工具
  planner_executor   Planner-Executor
  rag_agent          RAG-Agent
  ```

- [ ] **Step 4: 扩展保存顺序和错误语义**

  `handleSave()` 顺序固定为：

  1. 现有 `POST /api/agents`。
  2. 成功后调用 `saveAgentTopology(manifest.agent_id, topologyType)`。
  3. 两者成功后显示 `Agent 与拓扑已保存`，再调用 `onAgentSaved`。

  如果第 2 步失败，显示“Agent 已保存，但拓扑保存失败”，不假装整体成功，也不回滚已经成功的 Agent Manifest；用户可以再次点击保存重试拓扑。保存期间禁用表单保存动作，避免重复请求。

- [ ] **Step 5: 保留恢复预设行为**

  “恢复预设”同时恢复 `CORPMATE_AGENT_DRAFT` 和 `single` 拓扑，但不自动写入后端，只有点击保存后才提交。

- [ ] **Step 6: 更新样式和结构测试**

  复用已有 Agent 表单的 warm surface、蓝色、细边框和紧凑间距；不要新增组件库或大块卡片套卡片。桌面三列可读，窄屏单列；radio 选中态不改变整体高度。

  结构测试必须断言：三项 key、默认 single、POST `/api/topology/`、`preset_name`、拓扑失败文案和恢复预设行为。

- [ ] **Step 7: Run and commit**

  ```text
  node --test apps/main-platform/app/windows/main/agent/agent-topology-form.test.mjs
  pnpm -C apps/main-platform run type-check:app
  git add apps/main-platform/app/windows/main/agent/AgentInterfaceWorkspace.tsx apps/main-platform/app/styles/window-3-main.css apps/main-platform/app/windows/main/agent/agent-topology-form.test.mjs
  git commit -m "feat: add topology selection to agent interface"
  ```

**完成标准：** Agent 接入页能选择、回显、保存三种 topology；Manifest 请求不新增字段；拓扑保存失败可重试；页面不刷新。

---

## Task 3: 在 Security Profile 第一屏增加拓扑结构展示

**目的：** 保留现有安全画像边界图和 D1-D8 防御第二屏，只在第一屏增加当前 Agent 的拓扑结构摘要。

**Files:**
- Create: `apps/main-platform/app/windows/main/topology/TopologyStructurePanel.tsx`
- Modify: `apps/main-platform/app/windows/main/MainWindow.tsx`
- Modify: `apps/main-platform/app/windows/main/profile/SecurityProfileGraph.tsx`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Create: `apps/main-platform/app/windows/main/topology/topology-structure.test.ts`
- Modify: `apps/main-platform/app/windows/main/profile/security-profile-graph-structure.test.mjs`

**Interfaces:**

```ts
type TopologyStructurePanelProps = {
  topology: AgentTopology;
  isLoading?: boolean;
  errorMessage?: string | null;
};
```

- [ ] **Step 1: 把 activeAgentId 传给 SecurityProfileGraph**

  修改 `MainWindowContent` 的 profile 分支，传入当前 `activeAgentId`。保留 `securityProfileFixtureViewModel` 作为现有边界图数据源，不借此任务把 profile 整体改成 live profile API。

- [ ] **Step 2: 在 SecurityProfileGraph 内加载 topology**

  用 `defaultTopologyRepository.loadAgentTopology(agentId)` 加载拓扑，维护 `isLoadingTopology` 和 result。profile 页首次进入时展示稳定的 loading 占位，不改变已有 graph freeze、screen transition 和 D1-D8 状态。

- [ ] **Step 3: 实现 TopologyStructurePanel**

  `single` 时返回 `null`，保证 Stage 3 页面不增加额外视觉内容。非 single 时展示：

  - 拓扑中文名和原始 `topology_type`；
  - 从 `nodes` 按数组顺序展示节点、角色、trust boundary 和 tools；
  - 按 `edges` 展示 channel 和 `from_node → to_node`；
  - `carries_untrusted_content: true` 的边使用警示色和“可能携带不可信内容”标记。

  采用一条紧凑横向 flow rail，不做可编辑节点，不增加图表库。角色文案至少覆盖 `PLANNER`、`EXECUTOR`、`RETRIEVER`、`KNOWLEDGE_BASE`、`AGENT`。

- [ ] **Step 4: 放置在 profile 第一屏**

  将 panel 放在现有 permission summary 和 `.security-profile-workspace` 之间，只在 `.security-profile-profile-screen` 渲染；防御 screen 不渲染该 panel。panel 必须适配既有固定 viewport，不能触发页面级滚动或改变第二屏的切换结构。

- [ ] **Step 5: 测试**

  纯数据测试覆盖 planner-executor、rag-agent 节点/边文案、untrusted edge、single 隐藏。结构测试覆盖 profile 接收 `activeAgentId`、调用 topology repository、拓扑 panel 位于第一屏、D1-D8 screen 不受影响。

- [ ] **Step 6: Run and commit**

  ```text
  node --experimental-strip-types --test apps/main-platform/app/windows/main/topology/topology-structure.test.ts
  node --test apps/main-platform/app/windows/main/profile/security-profile-graph-structure.test.mjs
  pnpm -C apps/main-platform run type-check:app
  git add apps/main-platform/app/windows/main/topology apps/main-platform/app/windows/main/MainWindow.tsx apps/main-platform/app/windows/main/profile/SecurityProfileGraph.tsx apps/main-platform/app/styles/window-3-main.css
  git commit -m "feat: show agent topology in security profile"
  ```

**完成标准：** 非 single Agent 在安全画像第一屏能看到结构、角色和危险数据流；single 和防御可视化第一屏/第二屏保持原有体验。

---

## Task 4: 扩展 Anatomy 数据模型到 R5/R6

**目的：** 先扩展路径语义和 view model，再制作 SVG，避免把 R5/R6 文案直接写死在 JSX 中。

**Files:**
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-data.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-fixtures.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-data.test.ts`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-graph-structure.test.mjs`

**Interfaces:**
- `AnatomyPathStep["role"]` 增加 `knowledge_base`。
- 现有 `AnatomyPath`、`AnatomyViewModel` 字段继续兼容；不新增另一套 RiskPattern 类型。

- [ ] **Step 1: 保留 R1-R4 默认顺序，增加 R5/R6 元数据**

  `PATH_ORDER` 保持 R4 默认聚焦，但加入 R5、R6。建议顺序为 `R4, R1, R2, R3, R5, R6`，以保留当前默认视图，同时让新增风险排在基础风险之后。增加 `PATH_STORIES`、`VERIFY_COPY`：

  ```text
  R5: 不可信网页内容进入 Planner，污染其生成的 task plan，随后由 Executor 触发危险工具。
  R6: 外部文档进入知识库后被 Retriever 取回，污染主 Agent 上下文并影响危险工具调用。
  ```

- [ ] **Step 2: 增加节点查找和路径步骤规则**

  从后端 graph node 的 `metadata.role` 和 `node_type` 查找节点，不依赖节点数组位置：

  - R5：`SOURCE(browser)` → `AGENT(role=planner)` → `AGENT(role=executor)` → dangerous `TOOL`。
  - R6：`SOURCE(name=External Documents)` → `KNOWLEDGE_BASE` → `AGENT(role=retriever)` → `AGENT(role=agent)` → dangerous `TOOL`。

  缺失节点时使用已有 fallback label，但不伪造“已验证”。`status` 仍然只由 `evaluationReport.findings` 决定；`risk_path_ids` 只能产生 `potential`。

- [ ] **Step 3: 更新角色映射和验证数据**

  `getNodeRole()` 映射 `KNOWLEDGE_BASE` 到 `knowledge_base`，`createVerification()` 从现有 test case/attack seed 数据中寻找 R5/R6；没有绑定用例时返回 `null`，不阻塞页面渲染。

- [ ] **Step 4: 增加纯数据测试**

  测试 R1-R4 输出不变；planner-executor graph 能生成 R5 四步；rag-agent graph 能生成 R6 五步；R5/R6 finding 才能变成 `verified`；没有 finding 时仍是 `potential`。

- [ ] **Step 5: Run and commit**

  ```text
  node --experimental-strip-types --test apps/main-platform/app/windows/main/anatomy/anatomy-data.test.ts
  node --test apps/main-platform/app/windows/main/anatomy/anatomy-graph-structure.test.mjs
  git add apps/main-platform/app/windows/main/anatomy
  git commit -m "feat: model topology risk paths in anatomy"
  ```

**完成标准：** R5/R6 能从真实 graph/risk pattern 数据生成与 R1-R4 同结构的 AnatomyPath，且验证状态来源没有变化。

---

## Task 5: 在攻击图谱 SVG 中展示拓扑节点和 R5/R6

**目的：** 非 single 图谱使用拓扑感知 SVG；single 继续走现有五阶段 R1-R4 SVG，不改变默认图的坐标、动画和节点尺寸。

**Files:**
- Create: `apps/main-platform/app/windows/main/anatomy/TopologyAttackGraphPanel.tsx`
- Create: `apps/main-platform/app/windows/main/anatomy/topology-graph-layout.ts`
- Create: `apps/main-platform/app/windows/main/anatomy/topology-graph-structure.test.mjs`
- Modify: `apps/main-platform/app/windows/main/anatomy/AnatomyGraph.tsx`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-graph-layout.ts`

**Interfaces:**

```ts
type TopologyAttackGraphPanelProps = {
  topology: AgentTopology;
  graph: AnatomyViewModel["graph"];
  selectedPath: AnatomyPath | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
};
```

- [ ] **Step 1: 为 topology graph 建立固定 SVG 布局**

  在 `topology-graph-layout.ts` 定义固定 viewBox `1120 x 520`、节点尺寸、角色样式和路线构造函数。至少提供以下稳定位置：

  - planner-executor：`n_source_browser` → `n_agent_planner` → `n_agent_executor` → `n_tool_email_send`。
  - rag-agent：`n_source_external_docs` → `n_knowledge_base` → `n_agent_retriever` → `n_agent_{agent_id}` → `n_tool_email_send`。

  额外的 memory/read/list 节点放在执行节点下方 side lane；没有匹配布局的非关键节点不进入主画布，但仍可在右侧 inspector 的节点详情中访问。不要修改现有 `ANATOMY_GRAPH_VIEWBOX` 或 R1-R4 `ROUTE_DEFINITIONS`。

- [ ] **Step 2: 实现 topology SVG 节点样式**

  - `KNOWLEDGE_BASE` 使用紫色圆柱形路径和 `Database`/`DatabaseZap` 图标。
  - `AGENT` + `metadata.role=planner` 使用蓝色节点并显示“规划”。
  - `AGENT` + `metadata.role=executor` 使用绿色节点并显示“执行”。
  - `AGENT` + `metadata.role=retriever` 使用青色节点并显示“检索”。
  - 普通主 Agent 使用现有 agent 语义样式。
  - 每个节点保留 HTML button hitbox、`aria-label`、focus outline 和现有 inspector 选择机制。

- [ ] **Step 3: 根据 AnatomyPath 动态构造 R5/R6 routes**

  不把 R5/R6 路线硬编码为另一套风险语义；由选中 `AnatomyPath.steps` 的相邻节点生成 SVG route。相同 `from_node/to_node` 的路线只画一次，并把所有对应 path IDs 合并到 `data-path-ids`，延续现有“同一节点对只画一条曲线”的约束。

- [ ] **Step 4: 接入现有 AnatomyGraph**

  `AnatomyGraph` 加载 topology result，并根据 `topology.topology_type` 分支：

  - `single` 或 topology fallback：继续渲染现有 map、R1-R4 布局、R4 默认 selected path。
  - `planner_executor`/`rag_agent`：渲染 `TopologyAttackGraphPanel`，路径列表继续复用现有 `viewModel.paths`，inspector 继续复用现有风险描述、验证和 evidence 区域。

  加载 topology 不得覆盖现有 graph repository 的 API/mock fallback；两个请求都失败时保持现有预览图。新图只增加视觉节点和路线，不改变 report finding 验证来源。

- [ ] **Step 5: 扩展 path list 和页面文案**

  R5/R6 以现有 Anatomy path card 形式显示 ID、名称、严重等级/状态和描述。桌面最多三列，窄屏两列，内容必须在现有页面高度内可读；不要新增一个独立导航页面。页面 header 在 topology 模式下补充当前拓扑名称。

- [ ] **Step 6: 保持 GSAP 和 reduced-motion 规则**

  topology SVG 复用现有 `.anatomy-reveal`、`.anatomy-route-stroke`、`.anatomy-svg-node` 语义；动画只负责 reveal/highlight，不参与 risk status、finding 或 route 计算。`prefers-reduced-motion: reduce` 下直接设置路线完整可见、节点稳定位置和选中态。

- [ ] **Step 7: 测试、截图和 commit**

  结构测试断言 KNOWLEDGE_BASE 圆柱/独立样式、planner/executor/retriever role label、R5/R6 path cards、单拓扑 legacy 分支和 no-chart-library 约束。使用现有 Playwright 配置检查 1440px、1024px、900px 和移动窄宽；验证图不裁切、hitbox 对齐、path cards 不遮挡 inspector。

  ```text
  node --test apps/main-platform/app/windows/main/anatomy/topology-graph-structure.test.mjs
  node --experimental-strip-types --test apps/main-platform/app/windows/main/anatomy/anatomy-graph-layout.test.ts
  pnpm -C apps/main-platform run type-check:app
  git add apps/main-platform/app/windows/main/anatomy apps/main-platform/app/styles/window-3-main.css
  git commit -m "feat: render topology nodes and r5 r6 attack paths"
  ```

**完成标准：** RAG 图能看到知识库、Retriever、主 Agent 和工具；Planner-Executor 图能看到 Planner、Executor 和 task plan 风险边；R5/R6 可选择、可查看、可验证；single 图与原来一致。

---

## Task 6: 扩展测评运行页到 R1-R6

**目的：** 让已有 TestCase 选择器识别并筛选 R5/R6，不改变 Evaluation Provider、SSE 事件和批量进度逻辑。

**Files:**
- Modify: `apps/main-platform/app/windows/main/evaluation/TestCaseSelector.tsx`
- Modify: `apps/main-platform/app/windows/main/evaluation/test-case-selection.ts`
- Modify: `apps/main-platform/app/windows/main/evaluation/test-case-selection.test.ts`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Modify: `apps/main-platform/app/windows/main/evaluation/EvaluationRunWorkspace.layout.test.ts`

**Interfaces:**
- `TestCaseSummary.target_risk_pattern` 继续使用生成类型中的 `string`，不修改 OpenAPI 注释或生成文件。
- `filterTestCases()` 的输入输出签名不变。

- [ ] **Step 1: 把筛选值扩展为 R1-R6**

  将 `RISK_PATTERNS` 改为 `ALL/R1/R2/R3/R4/R5/R6`，保持现有筛选函数的精确匹配行为。新增 label map：`R5 · 计划污染`、`R6 · RAG 上下文投毒`，下拉 value 仍是原始 `R5`/`R6`。

- [ ] **Step 2: 在 TestCase 行显示拓扑风险标记**

  当 `target_risk_pattern` 为 R5/R6 时，在现有 row meta 增加“拓扑风险”短标记，不改变选中、批量选择和排序。没有 R5/R6 数据时下拉仍正常显示，不造出虚假的 TestCase。

- [ ] **Step 3: 保持 handoff 和 Provider 边界**

  Anatomy 的 R5/R6 `验证`按钮仍写入既有 evaluation handoff，只更换 `riskPatternId`/`testCaseId`；`EvaluationWorkspaceProvider` 仍只负责现有 `POST /evaluations`、SSE 和批量状态。

- [ ] **Step 4: 测试**

  增加 R5/R6 filtering、query + risk filtering、空结果和混合 R1/R6 选择测试。结构测试确保没有改动 reducer、event enum、sessionStorage 或 terminal。

- [ ] **Step 5: Run and commit**

  ```text
  node --experimental-strip-types --test apps/main-platform/app/windows/main/evaluation/test-case-selection.test.ts
  node --test apps/main-platform/app/windows/main/evaluation/EvaluationRunWorkspace.layout.test.ts
  pnpm -C apps/main-platform run type-check:app
  git add apps/main-platform/app/windows/main/evaluation apps/main-platform/app/styles/window-3-main.css
  git commit -m "feat: expose topology risks in evaluation selector"
  ```

**完成标准：** 后端返回的 R5/R6 TestCase 可以筛选、选择、创建测评并进入现有运行流程；没有拓扑用例时现有选择器完全兼容。

---

## Task 7: 在测评报告中增加拓扑信息和覆盖摘要

**目的：** 报告页面显示被测 Agent 的 topology，并用已有报告 summary/findings 计算 R1-R4 与 R5-R6 的覆盖状态。

**Files:**
- Create: `apps/main-platform/app/windows/main/evaluation/report-topology-summary.ts`
- Create: `apps/main-platform/app/windows/main/evaluation/report-topology-summary.test.ts`
- Modify: `apps/main-platform/app/windows/main/evaluation/EvaluationReportWorkspace.tsx`
- Modify: `apps/main-platform/app/windows/main/evaluation/ReportSummaryPanel.tsx`
- Modify: `apps/main-platform/app/styles/window-3-main.css`
- Modify: `apps/main-platform/app/windows/main/evaluation/report-summary.test.ts`

**Interfaces:**

```ts
export type RiskCoverageGroup = {
  key: "base" | "topology";
  label: string;
  tested: number;
  total: number;
  available: boolean;
};

export function buildRiskCoverage(
  summary: ReportSummary | null | undefined,
  findings: RiskFinding[],
): RiskCoverageGroup[];
```

- [ ] **Step 1: 让报告按 `report.agent_id` 读取 topology**

  在 `EvaluationReportWorkspace` 获取报告成功后调用 `loadAgentTopology(report.agent_id)`。报告的 Agent ID 仍以报告返回值为准；topology API 失败时显示 `single`/不可用提示，不阻塞 finding、score 和 evidence。

- [ ] **Step 2: 实现 coverage 纯函数**

  `buildRiskCoverage()` 只使用现有 `ReportSummary.by_risk_pattern`、`report.findings` 和固定风险分组：

  - 基础组：R1-R4。
  - 拓扑组：R5-R6。

  优先使用 summary 中每个风险的总测试数；若 summary 缺失，则只把 finding 对应风险标为“已发现”，并把 `available` 标记为 false，显示“报告未返回完整覆盖统计”，不能把 finding 数量冒充测试总数。不得计算新的分数或修改后端报告。

- [ ] **Step 3: 增加报告 header topology 信息**

  在现有 `EvaluationAgentBadge` 附近加入只读 topology badge/metadata：拓扑中文名、原始类型和节点数量。`single` 也可以显示短 badge，但不得改变报告整体布局高度过多。

- [ ] **Step 4: 增加 R5/R6 Finding 展示**

  `FindingList` 不改数据筛选，继续展示所有 `report.findings`。只补充 R5/R6 的风险名称、拓扑标签和路径 ID 展示；`EvidenceDetail` 继续使用现有 evidence event 关联和脱敏规则。

- [ ] **Step 5: 扩展 ReportSummaryPanel**

  在现有 R1-R4/OTHER 图表旁增加一个紧凑 coverage block：

  ```text
  基础风险 R1-R4     4/4 已测试
  拓扑风险 R5-R6     2/2 已测试
  ```

  如果没有 R5/R6 TestCase，显示 `0/0 未启用`；如果报告缺失 summary，显示 `覆盖统计不可用`。现有 R1-R4/OTHER 图表仍使用 `buildRiskPatternRows()`，不改变它的排序和 PASS/FAIL/ERROR 语义。

- [ ] **Step 6: 测试**

  覆盖：完整 summary、没有 summary、只有 R5 finding、R5/R6 未启用、R5/R6 finding 进入 FindingList、topology API 失败仍能看报告、single 报告不改变原布局。

- [ ] **Step 7: Run and commit**

  ```text
  node --experimental-strip-types --test apps/main-platform/app/windows/main/evaluation/report-topology-summary.test.ts
  node --experimental-strip-types --test apps/main-platform/app/windows/main/evaluation/report-summary.test.ts
  pnpm -C apps/main-platform run type-check:app
  git add apps/main-platform/app/windows/main/evaluation apps/main-platform/app/styles/window-3-main.css
  git commit -m "feat: add topology context to evaluation reports"
  ```

**完成标准：** 报告能显示拓扑类型，R5/R6 finding 不被过滤，覆盖摘要能区分基础风险和拓扑风险，不虚构后端统计。

---

## Task 8: 端到端联调、兼容性验证和架构文档

**目的：** 验证完整用户路径，并把新的模块边界写入项目架构文档。

**Files:**
- Create: `apps/main-platform/e2e/stage4-topology.spec.ts`
- Modify: `docs/architecture/modules-index.md`
- Modify: `docs/architecture/extension-review-checklist.md`
- Modify: `apps/main-platform/app/windows/main/anatomy/anatomy-repository.ts` only if Task 5 requires a shared topology load boundary; otherwise leave unchanged.

- [ ] **Step 1: 编写 API-backed E2E 测试**

  使用现有 Playwright harness 和 backend fixture，不 mock 全局 network。至少覆盖：

  1. 初始接口选择 Planner-Executor，保存后无刷新回到当前 Agent。
  2. 安全画像第一屏显示 Planner/Executor 和不可信 task plan 边。
  3. 攻击图谱显示 R5，并能点击节点查看详情。
  4. 选择 R5/R6 TestCase，进入测评运行，筛选器保留选择。
  5. 完成报告后显示拓扑类型和 R5/R6 coverage。
  6. 切换回 single 后 profile/anatomy 不显示额外拓扑结构，R1-R4 默认图仍存在。

- [ ] **Step 2: 做失败和回退验证**

  分别验证 topology presets 失败、agent topology 404/503、POST topology 422、graph API fallback、报告 topology 失败。错误必须局部显示，不能清空已有 Agent、graph、run 或 report。

- [ ] **Step 3: 做视觉和可访问性验证**

  在 1440px、1024px、900px、390px 检查：

  - SVG 节点与 HTML hitbox 对齐；
  - 文字不出框、不重叠；
  - path cards、profile topology rail、report coverage 不产生页面级滚动；
  - radio、节点、风险路径和 report finding 都能通过键盘操作；
  - `prefers-reduced-motion` 下没有残留透明、偏移或未绘制路线。

- [ ] **Step 4: 更新模块索引和审查清单**

  在 `modules-index.md` 增加 topology module、BFF、Agent selector、profile summary、Anatomy topology branch、run/report display boundary。明确 topology types 是本地临时 wire types，待后端 OpenAPI 正式纳入后再迁移；明确 single fallback 和不修改冻结 evaluation/anatomy 语义。

  在 `extension-review-checklist.md` 增加对应 checklist：BFF only、snake_case、no backend/shared-contract changes、R5/R6 finding source、single compatibility、no third-party graph library、reduced-motion and responsive checks。

- [ ] **Step 5: 运行默认验证**

  ```text
  pnpm -C apps/main-platform run verify:default
  pnpm -C apps/main-platform run test:e2e -- e2e/stage4-topology.spec.ts
  ```

  如果默认验证遇到 Next binary sandbox/ACL 问题，按项目规则只重试一次 approved elevated execution；如果到达真实 lint/type/build/test 失败，记录真实失败，不通过无关改动绕过。

- [ ] **Step 6: Commit**

  ```text
  git add apps/main-platform/e2e/stage4-topology.spec.ts docs/architecture/modules-index.md docs/architecture/extension-review-checklist.md
  git commit -m "test: verify stage 4 topology flow"
  ```

**完成标准：** 从 Agent 接入到报告的完整链路无需刷新；topology API、R5/R6、profile、anatomy、run、report 都可联调；single 模式通过回归验证；架构文档记录了新的边界和冻结约束。

---

## Recommended Execution Order

按以下顺序一次完成一个 Task，不要先做视觉大改：

```text
Task 1  topology types/repository/BFF
Task 2  Agent 接入选择器
Task 3  Security Profile 拓扑摘要
Task 4  Anatomy R5/R6 数据模型
Task 5  Anatomy topology SVG
Task 6  Evaluation Run R1-R6 筛选
Task 7  Evaluation Report topology/coverage
Task 8  联调、回归、文档
```

## Definition of Done

- [ ] Agent 接入页可选并保存 `single`、`planner_executor`、`rag_agent`。
- [ ] 页面加载会回显已保存 topology；读取/保存失败有局部错误和 fallback。
- [ ] Security Profile 第一屏展示非 single 的节点、角色、边和不可信内容标记。
- [ ] Anatomy SVG 展示 Planner、Executor、Retriever、KNOWLEDGE_BASE 等拓扑节点。
- [ ] Anatomy path list 和 inspector 展示 R5/R6，验证状态仍由 report finding 决定。
- [ ] Evaluation Run 的筛选器和 TestCase 列表支持 R1-R6。
- [ ] Evaluation Report 显示 topology 类型、R5/R6 finding 和基础/拓扑风险 coverage。
- [ ] `single` 模式下现有 Stage 3 页面、SSE、评分、sessionStorage 和导航行为保持兼容。
- [ ] 全流程不刷新页面，不新增第三方图表库，不修改后端和 frozen contracts。
- [ ] `pnpm -C apps/main-platform run verify:default` 和 Stage 4 focused E2E 已运行；任何无法运行的检查都在交付记录中说明。

