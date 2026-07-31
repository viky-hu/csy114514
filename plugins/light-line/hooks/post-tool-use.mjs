#!/usr/bin/env node

let input = {};
try {
  input = JSON.parse(await new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data || "{}"));
  }));
} catch {
  input = {};
}

const toolName = String(input.tool_name || "");
const command = String(input.tool_input?.command || "");
const response = JSON.stringify(input.tool_response || {});
const combined = `${toolName}\n${command}\n${response}`;
const notes = [];

if (/apply_patch|Edit|Write/i.test(toolName)) {
  notes.push("如果本次改动新增或改变行为，最终回复要包含功能归属、扩展性审查、必要重构和验证结果。");
}
if (/docs[\\/]architecture|modules-index|extension-review-checklist/i.test(combined)) {
  notes.push("架构文档已被触及，确认模块职责说明和扩展性审查记录彼此一致。");
}
if (/\.codex-plugin|marketplace\.json|hooks\.json|commands[\\/]/i.test(combined)) {
  notes.push("插件结构被触及，完成后运行 plugin 校验，并确认 marketplace 指向正确插件路径。");
}
if (/NEXT_PUBLIC_|SM4|token|secret|api[_-]?key/i.test(combined)) {
  notes.push("检测到敏感配置相关文本，请确认没有把服务端密钥、内部 URL 或 token 暴露到前端。");
}

if (notes.length === 0) {
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: `Light_line 编辑后提示：\n- ${notes.join("\n- ")}`
  }
}));
