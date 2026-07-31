#!/usr/bin/env node

const context = [
  "Light_line 已启用：这是 main-platform 前端项目的实践插件。",
  "开始代码任务前，先读取根 AGENTS.md 和目标目录更深层 AGENTS.md；更深层规则优先。",
  "新增或改变行为时，最终交付必须包含：功能归属声明、扩展性审查、必要重构。",
  "README 错题本 skills 覆盖技术栈、组件、UI、动效、时间轴；窗口治理和 plan 实践 skills 位于插件 skills/。",
  "可用 command 模板位于插件 commands/；可用 workflow 长说明位于插件 workflows/。"
].join("\n");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: context
  }
}));
