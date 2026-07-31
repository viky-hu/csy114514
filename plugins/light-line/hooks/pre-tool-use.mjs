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
const text = `${toolName}\n${command}`;

const destructivePatterns = [
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-[^\n]*[fdx]/i,
  /rm\s+-rf\s+(\.|\/|~|\*)/i,
  /Remove-Item\b[^\n]*(?:-Recurse|\/s)/i,
  /rmdir\s+\/s/i
];

if (destructivePatterns.some((pattern) => pattern.test(text))) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Light_line 拦截了明显破坏性命令。若确实需要清理或重置，请先让用户明确确认具体路径和操作。"
    }
  }));
  process.exit(0);
}

const notes = [];

if (/apply_patch|Edit|Write/i.test(toolName)) {
  notes.push("编辑前确认目标目录 AGENTS.md 规则；新增或改动行为后要交付功能归属、扩展性审查、必要重构。");
}
if (/app[\\/]api|\/api\//i.test(command)) {
  notes.push("涉及 BFF/API 时，Route Handler 只做解析、校验、调用服务、返回稳定响应；不要暴露服务端密钥。");
}
if (/gsap|rive|three|vis-network|animation|timeline/i.test(command)) {
  notes.push("涉及动效时，优先 transform/opacity，避免首屏并发初始化重负载模块，并记录 Edge + 125% 缩放风险。");
}

if (notes.length === 0) {
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: `Light_line 编辑前提示：\n- ${notes.join("\n- ")}`
  }
}));
