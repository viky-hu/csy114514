# Light_line 插件

这是一个仓库内本地 Codex 插件，用来把 `main-platform` 项目的前端实践浓缩成可安装、可分享的技能集合。对外展示名叫 `Light_line`，内部插件标识按规范使用 `light-line`。

第二版参考 `pm-skills` 的组织方式，但按 Codex 当前稳定插件结构落地：

- `skills/`：18 个中文 Codex Skills，覆盖 README 错题本、AGENTS 治理规范和计划实践。
- `commands/`：5 个带 frontmatter 的 command 模板，用来串联 skills，风格接近 `pm-skills` 的 slash workflow。
- `workflows/`：5 个端到端工作流长说明，用来解释 command 背后的流程。
- `hooks/`：插件内生命周期 hooks，包含 `hooks/hooks.json` 和 Node 脚本；启用插件后 Codex 可默认发现，但需要用户审阅信任后才会运行。
- `.codex-plugin/plugin.json`：Codex 插件 manifest。

## 安装方式

插件源码位于：

```text
plugins/light-line
```

仓库级 marketplace 位于：

```text
.agents/plugins/marketplace.json
```

在 Codex 中使用这个仓库级 marketplace 时，先把该 marketplace 添加到本地 Codex，然后安装插件：

```powershell
codex plugin marketplace add C:\Users\Admin\final\.agents\plugins
codex plugin add light-line@personal
```

如果你把插件发给别人，对方需要保留相同结构：

```text
<repo-or-package-root>/
  .agents/plugins/marketplace.json
  plugins/light-line/
```

然后把 `<repo-or-package-root>/.agents/plugins` 作为本地 marketplace 添加。

## 推荐触发语

- 按 Light_line 插件，帮我新增一个功能并做交付审查。
- 使用 Light_line command: new-frontend-feature，目标是 Window 4 聊天输入区，效果是优化初始态。
- 使用前端技术栈错题本，检查这次方案有没有栈边界错误。
- 用 Window 4 聊天治理 skill，审查聊天窗口改造。
- 按联邦协同检索聊天接入 workflow，规划 BFF 和后端链路。
- 做一次交付前审查，覆盖功能归属、扩展性、必要重构和文档同步。

## Commands

`commands/` 下的 Markdown 文件是可移植 command 模板。它们不是重复说明文档，而是把多个 skills 串成固定执行入口：

- `new-frontend-feature.md`
- `refactor-window-module.md`
- `connect-bff-rag.md`
- `optimize-motion-timeline.md`
- `delivery-review.md`

如果想在 Codex CLI 或 IDE 的 slash command 菜单中调用，可以把这些 Markdown 文件复制到本机 `~/.codex/prompts/`。官方更推荐可分享工作流使用 skills，因此插件内仍以 skills 作为正式能力主体。

## Hooks

`hooks/hooks.json` 是插件内 hooks 的默认发现入口。当前包含：

- `SessionStart`：注入 Light_line 项目上下文和交付门禁。
- `UserPromptSubmit`：根据用户提示推荐相关 command/skill。
- `PreToolUse`：在编辑或命令执行前提供边界提示，并拦截明显破坏性命令。
- `PostToolUse`：在编辑或命令执行后提醒插件校验、文档同步、密钥和扩展性检查。

插件 hooks 属于非托管 hooks。安装或启用插件后，需要在 Codex 的 `/hooks` 中审阅并信任当前 hook 定义，之后才会运行。

## 设计边界

第二版不把 `commands` 或 `hooks` 写入 `plugin.json`，因为当前插件校验对 manifest 字段更严格；`hooks/hooks.json` 位于 Codex 默认发现位置，不需要 manifest 显式声明。`commands/` 作为可复制 prompt 模板和 workflow 调度文档存在。

`useskills` 目录仍然作为原始浓缩实践库保留；插件内 `skills/` 是可安装版本。
