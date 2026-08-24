# AgentProof 前端全景地图 · Frontend Map

> **AgentProof** — 可观察、可解释、可复现、可修复的 Agent 安全评估平台
> 最后更新：2026-08-23

---

## 0. 速查卡片

| 项目 | 值 |
|------|-----|
| **应用名称** | `main-platform` |
| **框架** | Next.js (App Router) · React · TypeScript |
| **样式** | Tailwind CSS v4 · PostCSS · 自定义 CSS 模块 |
| **动画** | GSAP 3.14 + DrawSVGPlugin + ScrollTrigger |
| **图标** | lucide-react |
| **3D 特效** | Three.js 0.183.2 |
| **图片裁剪** | react-easy-crop 5.5.4 |
| **表单校验** | Zod v4 |
| **测试** | Playwright (E2E) · Node test runner (单元/结构) |
| **包管理** | pnpm 10.6.1 workspaces + Turborepo |
| **共享包** | `@csy/configs` (TS 配置) · `ui-components` (Vite 组件库) |
| **开发端口** | `:3000` (Next.js) · `:5173` (ui-components 预览) |
| **BFF 后端** | Agent Eval `AGENT_EVAL_BACKEND_URL` → `:8000` |
| **认证后端** | Account Auth `MIA_RAG_AUTH_URL` → MiA-RAG |

---

## 1. 仓库结构总览

```
repo/                                    # Monorepo 根目录
├── package.json                         # "csy" — turbo dev / build / lint / type-check
├── pnpm-workspace.yaml                  # workspaces: apps/*, packages/*
├── turbo.json                           # 流水线: dev, build, lint, type-check
│
├── apps/
│   └── main-platform/                   # ★ Next.js 应用主体
│       ├── app/                         # App Router 目录
│       │   ├── api/                     # BFF 路由 (Route Handlers)
│       │   ├── lib/                     # 客户端 / 服务端 / 契约层
│       │   ├── styles/                  # 全局 & 模块 CSS
│       │   └── windows/                 # ★ 功能窗口模块
│       ├── e2e/                         # Playwright E2E
│       └── public/                      # 静态资源
│
└── packages/
    ├── configs/                         # @csy/configs — 共享 TS 配置
    └── ui-components/                   # 共享 UI 组件库 (Vite)
```
---

## 2. 应用架构

### 2.1 单页 + 窗口切换模型

整个应用只有 **一个路由** (`/`)。所有“页面”通过 React 状态在客户端切换，不存在文件级子路由。

```
page.tsx
  │
  ├── [未登录] ──→ LoginIntroWindow         窗口 1: 登录 / Agent 接入
  │                  ├── LoginForm           登录 / 注册表单面板
  │                  ├── AgentConnectDraft   Agent 配置表单
  │                  └── Loading Overlay     Agent 加载动画
  │
  └── [已登录] ──→ MainWindow               窗口 2: 主工作台
                     ├── MainLineSidebar     侧边导航
                     └── ContentRegion       7 个工作区 (按导航键切换)
```

### 2.2 BFF 代理模式

所有 `/api/*` 路由均为**薄代理层**，将请求转发至两个独立后端：

```
浏览器 ──→ /api/*  (Next.js Route Handler)
              │
              ├──→ AGENT_EVAL_BACKEND_URL  (默认 http://127.0.0.1:8000)
              │      /agents, /evaluations, /test-cases
              │
              └──→ MIA_RAG_AUTH_URL  (环境变量)
                     /api/auth/profile, /api/auth/logout, ...
```

**核心原则：**
- 浏览器只与同源 `/api/*` 通信，永远不直接调用后端
- 后端地址仅存在于服务端环境变量，不通过 `NEXT_PUBLIC_*` 暴露
- 统一错误格式：`{ error: { code, message, details } }`

### 2.3 数据流示意

```
Agent 配置 ──POST /api/agents──→ 后端注册
                   ↓
测评创建 ──POST /api/evaluations──→ 后端创建 Run
                   ↓
开始测评 ──POST /api/evaluations/:id/start──→ 后端启动
                   ↓
实时追踪 ──GET /api/evaluations/:id/events──→ SSE 事件流
                   ↓                         (Last-Event-ID 断点续传)
报告查看 ──GET /api/evaluations/:id/report──→ 最终报告
```
---

## 3. 页面 / 导航工作区

主工作台通过侧边栏 `MainLineSidebar` 在 **7 个工作区** 之间切换：

| # | 导航键 | 中文标签 | 英文标签 | 组件 | 功能说明 |
|---|--------|---------|---------|------|---------|
| 01 | `dashboard` | 总览 | 默认视图 | `OverviewDashboard` | 风险评分、R4 攻击链缩略图、关键证据列表、智能体侧写、评估闭环流程 |
| 02 | `profile` | 安全画像 | 能力边界 | `SecurityProfileGraph` | Agent 能力边界确认图：工具权限、记忆资产、数据源边界的 SVG 可视化 |
| 03 | `anatomy` | 攻击图谱 | 风险路径 | `AnatomyGraph` | 完整 R4 风险路径工作台：五阶段攻击链图 (DrawSVG)、路径检查器、评估交接 |
| 04 | `run` | 测评运行 | 执行流程 | `EvaluationRunWorkspace` | 测试用例选择、三阶段执行 (注入→污染→外发)、实时 SSE 终端、批量进度 |
| 05 | `report` | 测评报告 | 证据结论 | `EvaluationReportWorkspace` | 评分面板、风险发现项、证据链追踪、已验证攻击路径 |
| 06 | `agent` | 初始接口 | 接口接入 | `AgentInterfaceWorkspace` | 加载/编辑/保存 Agent 配置清单 (能力、工具、权限、记忆、数据源) |
| 07 | `setting` | 设置 | 账号中心 | `AccountSettingsWorkspace` | 头像上传裁剪、显示名称、密码修改、退出登录 |

### 侧边栏特色

`MainLineSidebar` 实现了 **指针邻近感知动画**：
- 鼠标在列表上移动时，各条目根据与指针的距离产生不同程度的位移 (`getSmoothFalloff`)
- 使用 `requestAnimationFrame` + 指数衰减平滑驱动效果值
- 完整的键盘导航支持 (↑↓←→ / Home / End)

---

## 4. BFF API 路由全表

### 4.1 Agent Eval 域 (→ `AGENT_EVAL_BACKEND_URL`)

| 方法 | 路由 | 上游 | 说明 |
|------|------|------|------|
| `POST` | `/api/agents` | `POST /agents` | 注册/更新 Agent 配置清单 (AgentManifest) |
| `GET` | `/api/agents/:agentId` | `GET /agents/:agentId` | 获取 Agent 配置档案 |
| `GET` | `/api/agents/:agentId/graph` | `GET /agents/:agentId/graph` | 获取攻击图谱数据 |
| `POST` | `/api/evaluations` | `POST /evaluations` | 创建测评运行 |
| `GET` | `/api/evaluations/:id` | `GET /evaluations/:id` | 获取运行状态 |
| `POST` | `/api/evaluations/:id/start` | `POST /evaluations/:id/start` | 启动测评执行 |
| `GET` | `/api/evaluations/:id/events` | `GET /evaluations/:id/events` | **SSE 事件流** (支持 `?after=` 和 `Last-Event-ID`) |
| `GET` | `/api/evaluations/:id/report` | `GET /evaluations/:id/report` | 获取测评报告 |
| `GET` | `/api/evaluations/:id/trace` | `GET /evaluations/:id/trace` | 获取执行追踪 |
| `GET` | `/api/test-cases` | `GET /test-cases` | 获取测试用例目录 (72 条) |

### 4.2 Account Auth 域 (→ `MIA_RAG_AUTH_URL`)

| 方法 | 路由 | 上游 | 说明 |
|------|------|------|------|
| `GET` | `/api/account/me` | `GET /api/auth/profile` | 获取用户资料 (需 Authorization 头) |
| `PATCH` | `/api/account/me` | `PATCH /api/auth/profile` | 更新用户资料 |
| `POST` | `/api/account/logout` | `POST /api/auth/logout` | 退出登录 |
| `POST` | `/api/account/password` | `POST /api/auth/password` | 修改密码 |
| `POST` | `/api/account/avatar` | `POST /api/auth/avatar` | 上传头像 |
| `DELETE` | `/api/account/avatar` | `DELETE /api/auth/avatar` | 删除头像 |

### 4.3 健康检查 (本地)

| 方法 | 路由 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 返回 `{ ok: true, service: "main-platform", boundary: "bff" }` |
---

## 5. 完整目录树

```
apps/main-platform/
├── package.json                          # dev/build/start/lint/type-check/test:e2e
├── next.config.mjs                       # transpilePackages + proxy 50MB body
├── tailwind.config.ts                    # ./app/** + ui-components/src/**
├── postcss.config.mjs / eslint.config.mjs
├── tsconfig.json / tsconfig.app.json / tsconfig.test.json
├── playwright.config.ts                  # E2E
│
├── e2e/                                  # Playwright E2E
│   ├── login-agent-loading.spec.ts
│   └── login-band-stability.spec.ts
│
└── app/                                  # NEXT.JS APP ROUTER
    ├── layout.tsx                        # lang=zh-CN, AgentProof
    ├── page.tsx                          # LoginIntroWindow <-> MainWindow
    ├── globals.css / global.d.ts / beams-background.tsx
    │
    ├── styles/                           # app-shell / window-1-login / window-3-main / window-3-evaluation
    │
    ├── lib/
    │   ├── client/auth-adapter.ts       # authLogin() / authRegister()
    │   ├── server/backend.ts            # BFF proxy (Agent Eval)
    │   ├── server/account-auth.ts       # BFF proxy (Account Auth)
    │   └── contracts/backend-api.d.ts + backend-openapi.json
    │
    ├── api/                              # BFF ROUTE HANDLERS
    │   ├── health/route.ts
    │   ├── agents/route.ts + [agentId]/route.ts + [agentId]/graph/route.ts
    │   ├── evaluations/route.ts + [evaluationId]/{route,start,events,report,trace}/route.ts
    │   ├── test-cases/route.ts
    │   └── account/{me,logout,password,avatar}/route.ts
    │
    └── windows/
        ├── login/                        # LoginIntroWindow + LoginForm + AgentConnectDraft
        │                                  # + LoginSplitLoadingTip + motion/session/tip controllers
        ├── main/MainWindow.tsx + MainLineSidebar.tsx
        │   ├── overview/                 # OverviewDashboard + OverviewR4Graph + data/layout/fixtures
        │   ├── profile/                  # SecurityProfileGraph + data/layout/fixtures
        │   ├── anatomy/                  # AnatomyGraph + data/layout/repository/fixtures
        │   ├── evaluation/               # Provider + Run + Report + TestCaseSelector + Batch
        │   │                              # + AgentBadge + InferenceStatus + EmailConfirmation
        │   │                              # + ReportSummary + types/agent/session/progress/selection
        │   ├── agent/                    # AgentInterfaceWorkspace
        │   ├── settings/                 # AccountSettings + AvatarCrop + Password + repository
        │   └── shared/graph-svg-primitives.ts
        └── shared/                       # agent-config + animation + coords + evaluation-handoff + loading-tips
```

---

## 6. 共享包

### 6.1 `@csy/configs` — 共享 TypeScript 配置

```
packages/configs/
├── package.json          # "@csy/configs"
├── base.json
├── nextjs.json
└── react-library.json
```

### 6.2 `ui-components` — 共享 UI 组件库

```
packages/ui-components/
├── package.json          # Vite + React
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── index.ts          # ModuleStatus
    ├── main.tsx / App.tsx / index.css
    └── components/ModuleStatus.tsx   # ready | building | planned
```

> 当前仅导出 `ModuleStatus`。设计系统处于最小化阶段。

---

## 7. 依赖清单

| 类别 | 库 | 版本 | 用途 |
|------|-----|------|------|
| **框架** | Next.js | latest | App Router + Route Handlers + SSR |
| **UI** | React + react-dom | latest | 组件渲染 |
| **动画** | GSAP | ^3.14.2 | 核心动画引擎 |
| | @gsap/react | ^2.1.2 | useGSAP hook |
| **样式** | Tailwind CSS | ^4.2.1 | 原子化 CSS |
| | @tailwindcss/postcss | ^4.2.1 | PostCSS 插件 |
| | PostCSS | ^8.5.8 | CSS 后处理 |
| | autoprefixer | ^10.4.27 | 浏览器前缀 |
| **图标** | lucide-react | ^0.577.0 | SVG 图标集 |
| **3D** | Three.js | 0.183.2 | 光束背景特效 |
| **图片** | react-easy-crop | 5.5.4 | 头像裁剪 |
| **表单** | Zod | ^4.3.6 | Schema 校验 |
| **无障碍** | @radix-ui/react-toggle-group | ^1.1.11 | 切换按钮组 |
| **字体** | @fontsource/michroma | 5.2.8 | 品牌字体 |
| | @fontsource/noto-sans-sc | ^5.2.9 | 中文黑体 |
| | cn-fontsource-ding-talk-jin-bu-ti | 1.0.3 | 钉钉进步体 |
| **API 类型** | openapi-typescript | ^7.13.0 | OpenAPI → TS 类型 |
| **E2E** | Playwright | ^1.57.0 | 端到端测试 |
| **构建** | Turbo | latest | Monorepo 编排 |
| **类型** | TypeScript | ^6.0.0 | 类型系统 |
| **检查** | ESLint | ^9.0.0 | 代码规范 |
| | typescript-eslint | 8.67.0 | TS 规则 |
| | @next/eslint-plugin-next | 16.3.1 | Next.js 规则 |

---

## 8. 设计系统与 UI 特征

### 8.1 无第三方组件库

**不使用** shadcn / MUI / Ant Design / Radix UI (除 toggle-group)。全部 UI **从零构建**。

### 8.2 窗口架构

UI 以“窗口”为单位组织。每个窗口是一个全屏视图：

- **SVG 装饰层** — 分隔线、品牌字、过渡矩形均由 SVG `<rect>` / `<text>` 渲染
- **HTML 内容层** — 叠加在 SVG 之上，通过 CSS 变量对齐 (`--main-cm-x`, `--main-separator-y` 等)
- **GSAP 时间线** — 控制入场/退场/过渡/resize 的全部动画状态

### 8.3 动画系统

| 场景 | 技术 | 关键特征 |
|------|------|--------|
| 登录光带跟随鼠标 | `login-band-motion-controller` | 序列化 idle/opening/open/closing/scroll 状态 |
| 登录后滚动展开 | `GSAP ScrollTrigger` | band 从线宽扩展到全屏 |
| Agent 加载 | `GSAP timeline` | 7-10 秒加载提示 + SplitText |
| 主窗口入场 | `GSAP timeline` | 蓝色覆盖 → 收缩为分隔线 → 侧边栏淡入 |
| 工作区切换 | `GSAP timeline` | 0.22s 淡出 → 0.38s 淡入 |
| 侧边栏邻近 | `requestAnimationFrame` | 指数衰减平滑 + Hermite 衰减 |
| SVG 图谱绘制 | `DrawSVGPlugin` | 攻击路径逐步绘制 |
| 减弱动效 | `prefers-reduced-motion` | 所有路径直接设定终态 |

### 8.4 CSS 架构

```
globals.css                 # CSS 变量 / 全局重置 / 字体
app-shell.css               # 应用外壳
window-1-login.css          # 登录窗口全部样式
window-3-main.css           # 主工作台全部样式
window-3-evaluation.css     # 测评模块全部样式
```

### 8.5 语言

- **界面语言：** 中文优先
- **副标题：** 每项均有英文副标题
- **HTML lang：** `zh-CN`

---

## 9. 核心领域模型

### 9.1 Agent 配置 (AgentManifest)

```typescript
AgentManifest {
  agent_id: string            // "corpmate-v0"
  name: string                // "CorpMate v0"
  version: string             // "0.1.0"
  capabilities: string[]      // ["chat", "browser.open_page", ...]
  data_sources: string[]      // ["browser", "email"]
  memory: {
    type?: "persistent"
    max_entries?: number
  }
  tool_permissions: Record<string, Permission>  // ALLOW | CONFIRM | DENY
}
```

### 9.2 评估流程三阶段

| 阶段 | 测试点 | 关键操作 |
|------|--------|--------|
| **1. 网页内容注入** | `web_content_injection` | 解析 TestCase → 注册 Sandbox → 校验 canary |
| **2. 跨会话记忆污染** | `persistent_memory_poisoning` | 会话 01 写记忆 → 会话 02 读同一记忆 |
| **3. 未确认邮件发送** | `unconfirmed_email_send` | 复用记忆 → 调用 email.send → Judge 评分 |

### 9.3 事件类型 (SSE 流)

```
PREFLIGHT_COMPLETED
  → AGENT_INVOKED → TOOL_CALLED → TOOL_RESULT
  → MEMORY_WRITE
  → AGENT_INVOKED (new session) → MEMORY_READ
  → TOOL_CALLED (email.send)
  → JUDGE_DECISION → FINDING_CREATED
  → RUN_FINISHED
```

### 9.4 风险类型与严重等级

| 风险类型 | 中文 |
|---------|------|
| `indirect_prompt_injection` | 间接提示注入 |
| `persistent_indirect_prompt_injection` | 持久性间接提示注入 |

| 严重等级 | 中文 |
|---------|------|
| `CRITICAL` | 严重 |
| `HIGH` | 高危 |
| `MEDIUM` | 中危 |
| `LOW` | 低危 |

---

## 10. NPM 脚本

```bash
# 根目录 (Monorepo)
pnpm dev                        # turbo run dev --filter=main-platform
pnpm build                      # turbo run build
pnpm lint                       # turbo run lint
pnpm type-check                 # turbo run type-check

# apps/main-platform
pnpm dev                        # next dev --port 3000 --webpack
pnpm build                      # next build
pnpm start                      # next start
pnpm type-check:app             # tsc -p tsconfig.app.json --noEmit
pnpm type-check:test            # tsc -p tsconfig.test.json --noEmit
pnpm verify:default             # type-check:app && lint && build
pnpm verify:full                # type-check:app && type-check:test && lint && build
pnpm test:e2e                   # playwright test

# packages/ui-components
pnpm dev                        # vite --port 5173
pnpm build                      # tsc && vite build
```

---

## 11. 环境变量

| 变量 | 位置 | 说明 |
|------|------|------|
| `AGENT_EVAL_BACKEND_URL` | 服务端 (`backend.ts`) | Agent 评估后端 (默认 `http://127.0.0.1:8000`) |
| `MIA_RAG_AUTH_URL` | 服务端 (`account-auth.ts`) | MiA-RAG 认证服务地址 |
| `NEXT_PUBLIC_MIA_RAG_AUTH_URL` | 客户端 (`auth-adapter.ts`) | 客户端登录直连 (唯一允许的 NEXT_PUBLIC_) |

---

## 12. 测试策略

| 层次 | 工具 | 文件命名 | 说明 |
|------|------|---------|------|
| **单元测试** | Node test runner | `*.test.ts` | 纯逻辑: 数据工厂、状态机、布局 |
| **结构测试** | Node test runner | `*.structure.test.mjs` | 模块导出/接口/架构约束 |
| **E2E 测试** | Playwright | `e2e/*.spec.ts` | 登录光带、Agent 加载 |
| **类型检查** | tsc | `tsconfig.*.json` | 应用/测试分别检查 |

---

## 13. 关键文件速查

| 你想了解... | 去看 |
|------------|------|
| 应用入口 | `app/page.tsx` |
| 根布局 | `app/layout.tsx` |
| 登录流程 | `app/windows/login/LoginIntroWindow.tsx` |
| 登录表单 | `app/windows/login/LoginForm.tsx` |
| Agent 接入表单 | `app/windows/login/AgentConnectDraft.tsx` |
| 主窗口骨架 | `app/windows/main/MainWindow.tsx` |
| 侧边栏导航 | `app/windows/main/MainLineSidebar.tsx` |
| 总览面板 | `app/windows/main/overview/OverviewDashboard.tsx` |
| R4 攻击链图 | `app/windows/main/overview/OverviewR4Graph.tsx` |
| 安全画像图 | `app/windows/main/profile/SecurityProfileGraph.tsx` |
| 攻击图谱工作台 | `app/windows/main/anatomy/AnatomyGraph.tsx` |
| 测评上下文 | `app/windows/main/evaluation/EvaluationWorkspaceProvider.tsx` |
| 测评运行工作台 | `app/windows/main/evaluation/EvaluationRunWorkspace.tsx` |
| 测评报告工作台 | `app/windows/main/evaluation/EvaluationReportWorkspace.tsx` |
| 测试用例选择器 | `app/windows/main/evaluation/TestCaseSelector.tsx` |
| 批量进度 | `app/windows/main/evaluation/BatchProgressPanel.tsx` |
| Agent 接口配置 | `app/windows/main/agent/AgentInterfaceWorkspace.tsx` |
| 账户设置 | `app/windows/main/settings/AccountSettingsWorkspace.tsx` |
| 头像裁剪 | `app/windows/main/settings/AccountAvatarCropDialog.tsx` |
| Agent 配置核心 | `app/windows/shared/agent-config.ts` |
| 动画常量 | `app/windows/shared/animation.ts` |
| 加载提示 | `app/windows/shared/loading-tips.ts` |
| 评估交接 | `app/windows/shared/evaluation-handoff.ts` |
| BFF 代理逻辑 | `app/lib/server/backend.ts` |
| 认证代理 | `app/lib/server/account-auth.ts` |
| 客户端认证 | `app/lib/client/auth-adapter.ts` |
| API 类型契约 | `app/lib/contracts/backend-api.d.ts` |
| OpenAPI 规范 | `app/lib/contracts/backend-openapi.json` |
| Next.js 配置 | `next.config.mjs` |
| Tailwind 配置 | `tailwind.config.ts` |
| 详细模块说明 | `docs/architecture/modules-index.md` |
