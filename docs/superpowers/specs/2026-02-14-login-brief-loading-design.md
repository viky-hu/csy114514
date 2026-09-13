# 登录「稍后再说」短加载动画 设计文档

> 日期：2026-02-14
> 范围：仅登录页 Agent 接入的「稍后再说」按钮路径

## 背景

初始页（蓝屏 Agent 接入表单）右上角有两个按钮：

- 「确认接入」：把表单参数打包成 `AgentManifest` → `POST /api/agents` → 成功后才进入加载流程（后端不可用则报错停在页面）。
- 「稍后再说」：纯前端 mock，忽略表单参数，直接用内置默认 `corpmate-v0` 进入加载流程。

「稍后再说」当前走 `beginAgentLoading(DEFAULT_AGENT_ID)`，会播放约 **7–10 秒**的 mock 加载（蓝色覆盖层 + 多行 SplitText 接入文案逐字轮播，每句约 1.1–1.5s）。用户希望这条路径**跳过超长轮播**：蓝屏只停约 **1 秒**，然后收起、接上原有的进入主页面动画。

## 决策

- **方案 A（推荐，已确认）**：给加载入口加 `brief`（短）模式。「确认接入」保持完整时序不动；仅「稍后再说」走短模式。
- 约 1 秒的蓝色画面**仍显示 loader 图形 + 一句接入文案**（复用现有 `LoginSplitLoadingTip`），不轮播多句。
- 短模式下展示的是 boot 阶段的第一句文案。

## 改动点

### 1. `login-loading-tip-sequence.ts`
- 新增常量 `LOGIN_LOADING_BRIEF_TIP_HOLD_MS`（约 640ms）。
- 给 `createLoginMockLoadingPlan(agentId, brief?)` 与 `createLoginLoadingTipSequence(agentId, brief?)` 增加可选 `brief` 参数。
- `brief = true` 时，序列只取**一句** boot 阶段文案，hold 压缩到约 640ms；单句展示完、出口动画完成后即返回 `complete`。
- 原有 7–10s 的 `createLoginMockLoadingPlan` 逻辑完全保留（`brief` 缺省为 `false`），不影响「确认接入」与未来真实回退。

### 2. `LoginIntroWindow.tsx`
- `beginAgentLoadingRef.current` 的类型从 `(agentId?: string) => void` 扩展为 `(agentId?: string, brief?: boolean) => void`。
- `beginAgentLoading` 增加可选 `brief = false` 参数；`brief` 时为 `createLoginLoadingTipSequence(agentId, true)`，其余流程（锁滚动、淡入、`advanceLoadingTipSequence` → `finishAgentLoading` → `onAgentEntryComplete`）完全不改。
- 「稍后再说」按钮 onClick 改为 `beginAgentLoadingRef.current(DEFAULT_AGENT_ID, true)`。

### 3. 测试同步更新
- `login-loading-tip-sequence.test.mjs`：新增 brief 模式断言（单句、总时长 ≈1s）；保留原有 7–10s 断言。
- `login-window-layout-structure.test.mjs`：更新「稍后再说」onClick 断言以匹配新增的 `true` 参数。
- 运行 login 相关 Node 测试 + `pnpm -C apps/main-platform run type-check:app`。

### 4. 文档
- 更新 `docs/architecture/modules-index.md`（登录加载时序边界）与 `docs/architecture/extension-review-checklist.md`（login 「稍后再说」边界说明），补充 short/brief 模式。

## 完成标准

- 「稍后再说」点击后：蓝色覆盖层 + 一句文案约 1 秒自动收起 → 进入主页面原有 intro。
- 「确认接入」行为完全不变。
- login Node 测试、结构测试、`type-check:app` 通过。