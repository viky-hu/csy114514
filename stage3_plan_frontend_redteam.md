# Frontend Line — 自适应红队工作区计划

> 编制日期: 2026-08-24
> 编制人: AI Coding Agent (陈书扬审阅)
> 定位: 新增第 8 个导航工作区「红队演练」，展示自适应红队渗透测试结果
> 前置依赖: 后端 `RedTeamReport` JSON API 可用 (见 `stage3_plan_backend_redteam.md`)

---

## 0. 一句话定位

> **在侧边栏加一个"红队演练"入口，点进去能看到策略热力图、轮次演化、防御排行、权重折线四张可视化图表。**

---

## 1. 核心目标

| #   | 目标            | 衡量标准                             |
| --- | ------------- | -------------------------------- |
| G1  | 第 8 个工作区可用    | 侧边栏点击 `redteam` → 展示红队报告         |
| G2  | 4 张 SVG 可视化图表 | 策略热力图 + 轮次演化表 + 防御排行 + 权重折线      |
| G3  | Mock 先行       | 用 fixture JSON 开发，后端 API 就绪后无缝切换 |
| G4  | 风格一致          | 与现有 Overview / Anatomy 页面视觉风格统一  |

---

## 2. 页面结构设计

### 2.1 整体布局

```text
┌─ RedTeamWorkspace ─────────────────────────────────────┐
│                                                         │
│  RED TEAM · 攻击演练                                    │
│  自适应红队渗透测试                                       │
│                                                         │
│  ┌── 运行配置面板 ──┐  ┌── 摘要指标卡片 ─────────────┐  │
│  │                  │  │                              │  │
│  │  目标 Agent ▾    │  │  绕过率     变异数    轮次    │  │
│  │  轮次:  [2]      │  │   0/16       16       2     │  │
│  │  种子数: [4]     │  │   0.0%                      │  │
│  │  变异数: [2]     │  │                              │  │
│  │                  │  │  总耗时: 124.9s              │  │
│  │  [▶ 启动红队]   │  │                              │  │
│  │                  │  └──────────────────────────────┘  │
│  └──────────────────┘                                    │
│                                                         │
│  ┌── 策略有效性热力图 ────────────────────────────────┐  │
│  │                                                     │  │
│  │  encoding     ██████████████░░░  7变体  0绕过  0.91 │  │
│  │  social       ████████░░░░░░░░░  4变体  0绕过  1.00 │  │
│  │  cross_sess   ██████░░░░░░░░░░░  3变体  0绕过  0.70 │  │
│  │  synonym      ████░░░░░░░░░░░░░  2变体  0绕过  0.70 │  │
│  │  mixed_lang   ░░░░░░░░░░░░░░░░░  0变体  —     1.30 │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌── 轮次演化 ─────────────┐  ┌── 防御拦截排行 ──────┐  │
│  │                          │  │                       │  │
│  │  R1: 8变体 8✓ 0✗ 0绕过  │  │  D1 InputFilter  ████ │  │
│  │     encoding, synonym,   │  │           16 blocks   │  │
│  │     cross_session        │  │  D5 ChainDet   ██░░░ │  │
│  │                          │  │            3 blocks   │  │
│  │  R2: 8变体 8✓ 0✗ 0绕过  │  │  D2~D8       ░░░░░░░ │  │
│  │     mixed_lang, social,  │  │            0 blocks   │  │
│  │     encoding             │  │                       │  │
│  │                          │  └───────────────────────┘  │
│  └──────────────────────────┘                              │
│                                                         │
│  ┌── 权重演化折线 ────────────────────────────────────┐  │
│  │                                                     │  │
│  │  1.3 ┤                        ● mixed_lang           │  │
│  │  1.0 ┤ ●──────●──────●───────● social               │  │
│  │  0.9 ┤ ●─────● encoding                            │  │
│  │  0.7 ┤ ●─────● synonym                             │  │
│  │      ┤ ●─────● cross_session                       │  │
│  │  0.5 ┤                                             │  │
│  │      └──R1─────────R2──────→                       │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌── 种子详情 ────────────────────────────────────────┐  │
│  │  tc_def_safe_browse_002    R1   CRITICAL            │  │
│  │  tc_hard_social_002        R2   HIGH                │  │
│  │  tc_r3_priv_001            R3   HIGH                │  │
│  │  tc_def_refuse_006         R4   CRITICAL            │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 各图表技术方案

| 图表         | 技术           | SVG 元素                               | 代码量估算  |
| ---------- | ------------ | ------------------------------------ | ------ |
| **策略热力图**  | 横向柱状图 + 颜色深浅 | `<rect>` + `<text>`                  | ~80 行  |
| **轮次演化表**  | 表格 + 状态标记    | HTML `<table>` + severity badge      | ~60 行  |
| **防御拦截排行** | 横向柱状图        | `<rect>` + `<text>`                  | ~60 行  |
| **权重演化折线** | SVG 折线图      | `<polyline>` + `<circle>` + `<text>` | ~100 行 |

**全部用 SVG 手绘**，不引入 D3/ECharts/Recharts。与项目现有 `OverviewR4Graph`、`SecurityProfileGraph` 的 SVG 风格保持一致。

### 2.3 交互设计

```text
① 进入页面 → 自动 GET /api/redteam/report
   → 有报告: 渲染图表
   → 无报告 (404): 显示空状态 + "启动红队" 按钮

② 点击 "▶ 启动红队" → POST /api/redteam/start
   → 按钮变为 loading 状态 (转圈 + "执行中...")
   → 完成后自动刷新报告

③ 运行配置面板:
   → 目标 Agent: 下拉选择 (目前只有 defended-llm-v0)
   → 轮次/种子数/变异数: 数字输入框
   → 这些参数传给 POST /api/redteam/start

④ 策略热力图:
   → 鼠标 hover 某个策略条 → tooltip 显示详细信息

⑤ 权重演化折线:
   → 每条线一个颜色 (5 条线对应 5 个策略)
   → hover 某个点 → 显示该轮该策略的权重值
```

---

## 3. 新增 BFF 路由

### 3.1 路由清单

| 方法     | 路径                   | 上游                    | 说明     |
| ------ | -------------------- | --------------------- | ------ |
| `GET`  | `/api/redteam`       | `GET /redteam/report` | 获取红队报告 |
| `POST` | `/api/redteam/start` | `POST /redteam/start` | 启动红队测试 |

### 3.2 文件结构

```text
app/api/redteam/
├── route.ts                    # GET /api/redteam → 获取报告
└── start/
    └── route.ts                # POST /api/redteam/start → 启动红队
```

### 3.3 路由实现模板

```typescript
// app/api/redteam/route.ts
import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../lib/server/backend";

export const runtime = "nodejs";

export async function GET() {
  const upstreamUrl = buildAgentEvalBackendUrl("/redteam/report");
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
```

```typescript
// app/api/redteam/start/route.ts
import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../../lib/server/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const params = new URLSearchParams({
    agent_id: body.agent_id ?? "defended-llm-v0",
    rounds: String(body.rounds ?? 2),
    seeds_per_round: String(body.seeds_per_round ?? 4),
    variants_per_seed: String(body.variants_per_seed ?? 2),
    workers: String(body.workers ?? 4),
  });

  const upstreamUrl = buildAgentEvalBackendUrl(
    `/redteam/start?${params.toString()}`
  );
  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
```

---

## 4. 组件文件结构

### 4.1 新增目录

```text
app/windows/main/redteam/
├── RedTeamWorkspace.tsx           # 主工作区容器
├── RedTeamStrategyHeatmap.tsx     # 策略有效性热力图 (SVG)
├── RedTeamRoundTable.tsx          # 轮次演化表
├── RedTeamDefenseRanking.tsx      # 防御拦截排行 (SVG)
├── RedTeamWeightChart.tsx         # 权重演化折线 (SVG)
├── RedTeamSeedList.tsx            # 种子详情列表
├── RedTeamRunConfig.tsx           # 运行配置面板
├── RedTeamSummaryCards.tsx        # 摘要指标卡片
└── redteam-fixtures.ts            # Mock fixture 数据 + view model
```

### 4.2 修改文件

| 文件                                | 改动                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `app/windows/main/MainWindow.tsx` | ① `MainNavKey` 加 `"redteam"` ② `MAIN_NAV_ITEMS` 加一项 ③ `MainWindowContent` 加 case |
| `app/styles/`                     | 新增 `window-3-redteam.css`（或在 `window-3-main.css` 中追加）                            |

### 4.3 侧边栏注册

在 `MainWindow.tsx` 中:

```typescript
// 1. MainNavKey 类型加一项
type MainNavKey =
  | "agent"
  | "anatomy"
  | "dashboard"
  | "profile"
  | "redteam"   // ← 新增
  | "report"
  | "run"
  | "setting";

// 2. MAIN_NAV_ITEMS 数组加一项 (放在 "report" 和 "agent" 之间)
const MAIN_NAV_ITEMS: MainWindowNavItem[] = [
  { key: "dashboard", label: "总览",     english: "默认视图" },
  { key: "profile",   label: "安全画像", english: "能力边界" },
  { key: "anatomy",   label: "攻击图谱", english: "风险路径" },
  { key: "run",       label: "测评运行", english: "执行流程" },
  { key: "report",    label: "测评报告", english: "证据结论" },
  { key: "redteam",   label: "红队演练", english: "攻击演练" },  // ← 新增
  { key: "agent",     label: "初始接口", english: "接口接入" },
  { key: "setting",   label: "设置",     english: "账号中心" },
];

// 3. MainWindowContent 加渲染分支
if (activeNavKey === "redteam") {
  return <RedTeamWorkspace />;
}
```

**侧边栏位置**: 放在 "测评报告" 和 "初始接口" 之间（第 6 位），逻辑上红队是测评的延伸。

---

## 5. TypeScript 类型定义

### 5.1 类型位置

> 因为 `RedTeamReport` 是新增契约模型，需要与后端保持一致。
> 在 `backend-api.d.ts` 更新前，先手写临时类型 (放在 `redteam-fixtures.ts`)。
> 后端 OpenAPI 更新后，切换为生成的类型。

```typescript
// redteam-fixtures.ts 中的临时类型

interface StrategyEffectiveness {
  strategy: string;
  variants: number;
  bypasses: number;
  success_rate: number;
  weight_final: number;
}

interface DefenseEffectiveness {
  defense_id: string;
  defense_name: string;
  blocks: number;
}

interface RoundEvolution {
  round: number;
  variants: number;
  passed: number;
  failed: number;
  bypasses: number;
  active_strategies: string[];
}

interface BypassDetail {
  variant_id: string;
  seed_id: string;
  strategy: string;
  risk_pattern: string;
}

interface RedTeamReport {
  target_agent: string;
  rounds: number;
  seeds_count: number;
  variants_generated: number;
  bypasses_found: number;
  bypass_rate: number;
  total_time_s: number;
  round_evolution: RoundEvolution[];
  defense_effectiveness: DefenseEffectiveness[];
  strategy_effectiveness: StrategyEffectiveness[];
  weight_history: Record<string, number[]>;
  bypasses: BypassDetail[];
  seeds_used: { id: string; risk_pattern: string; severity: string }[];
}
```

**命名**: 字段名保持 `snake_case`（与 wire format 一致），不做 camelCase 转换。

### 5.2 Mock Fixture 数据

直接使用后端计划 §7 的样例 JSON，硬编码在 `redteam-fixtures.ts` 中:

```typescript
export const redTeamFixtureReport: RedTeamReport = {
  target_agent: "defended-llm-v0",
  rounds: 2,
  seeds_count: 4,
  // ... 完整数据 (见后端计划 §7)
};
```

---

## 6. 各组件详细设计

### 6.1 `RedTeamWorkspace.tsx` — 主容器

```text
职责:
  ① 页面骨架: header + 网格布局
  ② 数据获取: useEffect → GET /api/redteam/report → fallback fixture
  ③ 启动红队: handleStart → POST /api/redteam/start → 刷新
  ④ 状态管理: report | loading | error | empty

布局 (CSS Grid):
  grid-template-areas:
    "header  header"
    "config  summary"
    "heatmap heatmap"
    "rounds  defense"
    "weights weights"
    "seeds   seeds"

GSAP 动画:
  入场: 与现有工作区一致的 0.38s 淡入
  切换: 复用 MainWindow 的 transition timeline
```

### 6.2 `RedTeamStrategyHeatmap.tsx` — 策略热力图

```text
输入: StrategyEffectiveness[]
渲染: SVG 横向柱状图

每行:
  [策略名 120px] [████████░░░░░ 柱状条] [N变体] [N绕过] [权重]

柱状条:
  - 宽度按 variants 占比 (max variants = 100%)
  - 颜色: bypass_rate = 0 → 绿色; > 0 → 红色渐变
  - hover: 显示 tooltip (策略描述 + 目标防御层)

SVG 尺寸: 宽 100%, 高 auto (每行 36px)
```

### 6.3 `RedTeamRoundTable.tsx` — 轮次演化表

```text
输入: RoundEvolution[]
渲染: HTML <table>

列: 轮次 | 变异数 | PASS ✓ | FAIL ✗ | 绕过 | 活跃策略

状态颜色:
  bypasses = 0 → 绿色 ✓
  bypasses > 0 → 红色 ✗ + 闪烁

简洁的表格，与现有 evaluation report 的表格风格一致。
```

### 6.4 `RedTeamDefenseRanking.tsx` — 防御拦截排行

```text
输入: DefenseEffectiveness[]
渲染: SVG 横向柱状图 (按 blocks 降序排列)

每行:
  [D1] [InputFilter 120px] [████████ 柱状条] [N blocks]

柱状条:
  - 宽度按 blocks 占比 (max blocks = 100%)
  - 颜色: 蓝色 (与项目主色调一致)
  - blocks = 0 的防御层: 灰色虚线

SVG 尺寸: 宽 100%, 高 auto (每行 32px)
```

### 6.5 `RedTeamWeightChart.tsx` — 权重演化折线

```text
输入: Record<string, number[]> (weight_history)
渲染: SVG <polyline> + <circle>

5 条折线 (5 个策略), 每条一种颜色:
  encoding     → #3B82F6 (蓝)
  synonym      → #8B5CF6 (紫)
  cross_session → #F59E0B (黄)
  social       → #10B981 (绿)
  mixed_lang   → #EF4444 (红)

X 轴: 轮次 (R1, R2, ...)
Y 轴: 权重值 (0.0 ~ 1.5)

每个数据点: <circle r="4"> + hover tooltip
右侧: 图例 (策略名 + 颜色)

SVG viewBox: "0 0 600 200"
```

### 6.6 `RedTeamSummaryCards.tsx` — 摘要指标

```text
输入: RedTeamReport (顶层字段)
渲染: 4 张数字卡片 (CSS Grid 2×2)

卡片 1: 绕过率    → "0/16 (0.0%)"  → 绿/红色
卡片 2: 变异体数  → "16"
卡片 3: 轮次      → "2"
卡片 4: 总耗时    → "124.9s"

样式: 与 OverviewDashboard 的数字卡片一致
```

### 6.7 `RedTeamRunConfig.tsx` — 运行配置

```text
输入: 无 (本地 state)
渲染: 配置表单 + 启动按钮

字段:
  - 目标 Agent: <select> (目前只有 defended-llm-v0)
  - 轮次: <input type="number" min=1 max=10 value=2>
  - 种子数: <input type="number" min=1 max=20 value=4>
  - 变异数: <input type="number" min=1 max=5 value=2>

按钮:
  - 空闲: "▶ 启动红队"
  - 执行中: spinner + "执行中..." (disabled)
  - 完成: "✓ 完成" → 2s 后恢复空闲

提交: POST /api/redteam/start { agent_id, rounds, seeds_per_round, variants_per_seed }
```

### 6.8 `RedTeamSeedList.tsx` — 种子详情

```text
输入: seeds_used[]
渲染: 简洁列表

每行: [ID] [R1~R4 badge] [severity badge]

severity badge 颜色:
  CRITICAL → 红色
  HIGH     → 橙色
  MEDIUM   → 黄色
  LOW      → 灰色
```

---

## 7. 数据流

```text
页面加载
    │
    ├── GET /api/redteam
    │     │
    │     ├── 200 → 渲染图表 (真实数据)
    │     └── 404 → 渲染 fixture (mock 数据) + 提示 "无报告"
    │
    └── 用户点击 "▶ 启动红队"
          │
          ├── POST /api/redteam/start { params }
          │     │
          │     ├── 按钮 loading (禁用)
          │     ├── 等待后端执行 (~1-3 分钟)
          │     └── 200 → 收到 RedTeamReport JSON
          │           │
          │           ├── 更新 state
          │           ├── 重新渲染全部图表
          │           └── 按钮恢复 "▶ 启动红队"
          │
          └── 503 → 显示 "后端不可用" 错误
```

---

## 8. 工作量估算

| 步骤                         | 工作量     | 说明                    |
| -------------------------- | ------- | --------------------- |
| 类型定义 + fixture 数据          | 0.5 天   | `redteam-fixtures.ts` |
| `RedTeamWorkspace.tsx` 主容器 | 0.5 天   | 布局 + 数据获取 + GSAP      |
| 策略热力图 (SVG)                | 0.5 天   | ~80 行 SVG             |
| 轮次演化表                      | 0.25 天  | HTML table            |
| 防御排行 (SVG)                 | 0.5 天   | ~60 行 SVG             |
| 权重折线图 (SVG)                | 0.5 天   | ~100 行 SVG            |
| 运行配置 + 摘要卡片                | 0.5 天   | 表单 + 数字卡片             |
| BFF 路由 (2 条)               | 0.25 天  | 薄代理                   |
| 侧边栏注册 + CSS                | 0.25 天  | `MainWindow.tsx` + 样式 |
| 种子列表 + 联调                  | 0.25 天  | 简单列表 + 前后端联调          |
| **总计**                     | **4 天** |                       |

---

## 9. 与后端对接时间表

| 节点    | 前端任务               | 后端交付物                           |
| ----- | ------------------ | ------------------------------- |
| Day 1 | 用 fixture 数据开发全部组件 | `RedTeamReport` Pydantic 模型定稿   |
| Day 2 | 组件开发 + mock 渲染完成   | `--json` CLI 输出样例 JSON          |
| Day 3 | BFF 路由 + 接入真实 API  | `GET /redteam/report` 可用        |
| Day 4 | 联调 + 启动红队 + 打磨     | `POST /redteam/start` 可用 + 测试通过 |

---

## 10. CSS 架构

```text
方案: 在 window-3-main.css 末尾追加红队样式

新增 class 命名空间: .redteam-*

.redteam-page              → 页面容器 (与 .evaluation-page 平行)
.redteam-header            → 页面标题区
.redteam-grid              → CSS Grid 布局
.redteam-summary-card      → 摘要数字卡片
.redteam-config-panel      → 运行配置面板
.redteam-heatmap-row       → 热力图行
.redteam-defense-row       → 防御排行行
.redteam-weight-chart      → 权重折线图容器
.redteam-seed-item         → 种子列表项
.redteam-run-button        → 启动按钮 (含 loading 状态)
```

不新建独立 CSS 文件（保持现有 5 个 CSS 文件的架构不变）。

---

## 11. GSAP 动画

```text
① 工作区入场: 复用 MainWindow 的 0.38s 淡入 (不额外处理)
② 图表入场: 各图表 stagger 淡入 (0.1s 间隔)
③ 柱状条动画: <rect> width 从 0 过渡到目标值 (0.6s ease-out)
④ 折线绘制: DrawSVGPlugin 逐步绘制 (0.8s)
⑤ 数字卡片: 数字从 0 滚动到目标值 (CountUp 效果, 0.6s)
⑥ 启动按钮: loading 态 spinner 旋转
⑦ prefers-reduced-motion: 所有动画直接设终态
```

---

## 12. 可修改的文件范围

```text
✓ apps/main-platform/app/windows/main/redteam/    ← 新增目录
✓ apps/main-platform/app/windows/main/MainWindow.tsx ← 加 nav item
✓ apps/main-platform/app/api/redteam/              ← 新增 BFF 路由
✓ apps/main-platform/app/styles/window-3-main.css  ← 追加红队样式
✓ apps/main-platform/app/lib/contracts/backend-api.d.ts ← 加 RedTeam 类型 (后端更新后)

✗ 不得修改其他工作区组件
✗ 不得修改现有 BFF 路由
✗ 不得修改后端代码
✗ 不得修改 shared/contracts/ (由后端/组长统一管理)
✗ 不得引入 D3/ECharts/Recharts 等第三方图表库
✗ 不得新建 CSS 文件 (追加到现有文件)
```

---

## 13. 禁止事项

```text
① 不得修改现有 7 个工作区的任何代码
② 不得引入第三方图表库 (全部 SVG 手绘)
③ 不得做 SSE 实时进度 (Stage 3 再考虑)
④ 不得硬编码假数据 (fixture 只能作为 fallback)
⑤ 不得修改 shared/contracts/
⑥ 不得修改后端代码
⑦ 不得将字段名改为 camelCase
⑧ 不得大重构 MainWindow 的布局逻辑
```

---

## 14. Definition of Done

```text
① 侧边栏出现 "红队演练" 导航项，点击切换到红队工作区
② 4 张 SVG 图表正确渲染 fixture 数据
③ GET /api/redteam 返回数据时，图表切换为真实数据
④ POST /api/redteam/start 能触发红队运行并刷新图表
⑤ 运行配置面板参数可调并传给后端
⑥ 空状态 (无报告) 有合理提示
⑦ 错误状态 (后端不可用) 有合理 fallback
⑧ GSAP 入场动画与现有工作区风格一致
⑨ prefers-reduced-motion 下所有动画直接设终态
⑩ 全流程不刷新页面
```

---

*本计划待组长审阅确认后执行。*
