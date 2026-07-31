# Light_line Commands

本目录是 `pm-skills` 风格的 command 层：每个 Markdown 文件代表一个可复用的端到端入口，用来把多个 skills 串成固定工作流。

当前 Codex 官方更推荐用 skills 承载可分享工作流；本目录的 command 文件因此采取“可复制 prompt 模板”的方式存在。需要把它们变成 slash command 时，可以复制到本机 `~/.codex/prompts/` 目录，重新打开 Codex 后通过 `/prompts:<文件名>` 调用。

## 命令清单

- `new-frontend-feature.md`：新增前端功能。
- `refactor-window-module.md`：改造窗口模块。
- `connect-bff-rag.md`：接入 BFF / RAG / 联邦检索。
- `optimize-motion-timeline.md`：优化动效和时间轴。
- `delivery-review.md`：交付前审查。

## 使用方式

在对话中直接说：

```text
使用 Light_line command: new-frontend-feature，目标是……
```

或复制到 `~/.codex/prompts/` 后使用：

```text
/prompts:new-frontend-feature TARGET="Window 4 聊天输入区" GOAL="优化初始态"
```

这些 commands 只负责调度：它们要求 Codex 读取相关 skills、AGENTS 规则和目标代码，再执行或审查具体任务。
