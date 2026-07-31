# Hooks 说明

第二版已经加入插件内 hooks。Codex 默认会查找插件根目录下的 `hooks/hooks.json`，因此本插件不需要在 `plugin.json` 中额外声明 hooks 字段。

插件 hooks 属于非托管 hooks。安装或启用插件后，用户需要在 Codex 的 `/hooks` 中审阅并信任当前 hook 定义，hooks 才会运行。

## 会话开始检查

- 提醒读取根 `AGENTS.md` 和目标目录更深层 `AGENTS.md`。
- 注入 Light_line 的功能归属、扩展性审查和必要重构门禁。

入口：`session-start.mjs`

## 用户提示检查

- 根据用户提示推荐 command、workflow 和 skills。
- 对新增功能、窗口改造、BFF/RAG、动效和交付审查给出对应入口提示。

入口：`user-prompt-submit.mjs`

## 工具执行前检查

- 如果目标路径位于 `apps/main-platform/app/windows/**`，提醒确认窗口边界和 shared 层规则。
- 如果目标路径位于 `app/api/**`，提醒确认 BFF Route Handler 边界和环境变量安全。
- 拦截非常明确的破坏性命令，例如 `git reset --hard`、`git clean -fd`、`rm -rf /`、递归删除等。

入口：`pre-tool-use.mjs`

## 工具执行后检查

- 检查是否需要功能归属声明、扩展性审查和必要重构。
- 如果模块职责变化，提醒同步架构索引和扩展性审查记录。
- 对插件结构、密钥文本、公开环境变量和架构文档改动给出复查提示。

入口：`post-tool-use.mjs`

## 配置入口

入口：`hooks/hooks.json`

当前 hooks 默认以提示型为主，只对明显破坏性命令做阻断。这样能保留 pm-skills 式自动化护栏，同时不干扰正常开发节奏。
