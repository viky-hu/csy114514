---
name: window4-chat-governance
description: Window 4 交互对话治理 skill。用于修改 ChatInteractionPanel、聊天历史、模型配置、TraceWindow、TraceKnowledgeGraph、local global 模式和知识溯源流程时，保持对话、溯源、图谱边界清晰。
---

# Window 4 交互对话治理

## 模块职责

- `MainWindow.tsx`：Window 4 总编排与主流程切换。
- `ChatInteractionPanel.tsx`：聊天交互、历史记录、模型配置编排。
- `ChatHistoryGroup.tsx`：历史记录纯渲染组件。
- `ChatCanvasLines.tsx`：SVG 画布线条装饰。
- `ModelConfigCanvasLines.tsx`：模型配置面板画布线条。
- `DotGrid.tsx`：交互点阵背景。
- `TraceWindow.tsx`：溯源窗口全屏覆盖层。
- `TraceKnowledgeGraph.tsx`：vis-network 知识图谱。

## 强制规则

1. 回答主流程变更优先落在 `ChatInteractionPanel.tsx` 与服务调用层。
2. 溯源逻辑与对话主循环分层，避免状态互相污染。
3. 模式切换必须可预测，不允许隐式副作用。
4. `ChatHistoryGroup` 不 fetch、不持有动画 ref、不管理状态。
5. 删除确认弹窗用 portal 到 `document.body`，避免被 z-index 堆叠上下文困住。

## 会话与历史记录规则

- `activeConversationIdRef` 与 `activeConversationId` 必须同步。
- 发生 Conversation not found 时同时重置 ref 和 state。
- `persistTurn` 遇到 404 降级为新建会话，不静默放弃。
- 存储模式由服务层 `CHAT_HISTORY_STORAGE_MODE` 控制，组件不直接判断 mock 或 Prisma。

## 动画时序规则

- 历史列表 FLIP：`captureFlipState()` 在 `setConversations()` 之前调用。
- `useLayoutEffect` 执行 `Flip.from()`。
- 画布完成后再分段浮现模式切换行、消息流、输入区。
- 菜单打开时画布和信息流使用同一坐标位移计算。

## 扩展性审查

- 新增回答模式是否可插拔。
- 新增模型配置项是否无需改大量 UI 分支。
- 对话、溯源、图谱是否仍维持清晰边界。
- 新组件是否真的需要新增文件，当前组件目录已有文件数量警戒。
