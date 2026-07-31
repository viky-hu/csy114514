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

const prompt = String(input.prompt || "");
const hints = [];

if (/新增|添加|实现|开发|feature|功能/i.test(prompt)) {
  hints.push("建议使用 command: new-frontend-feature，并加载 frontend-stack/component/ui 与 repo-delivery-governance。");
}
if (/Window|窗口|聊天|数据库|宏观|login|登录/i.test(prompt)) {
  hints.push("涉及窗口模块时，先加载 window-module-boundary 和对应窗口治理 skill，避免跨窗口状态污染。");
}
if (/BFF|RAG|联邦|检索|FastAPI|接口|api/i.test(prompt)) {
  hints.push("涉及 BFF/RAG 时，使用 command: connect-bff-rag；前端只调用同域 Route Handler，敏感配置留在服务端。");
}
if (/动画|动效|GSAP|Rive|Three|时间轴|timeline|图谱|vis-network/i.test(prompt)) {
  hints.push("涉及动效时，使用 command: optimize-motion-timeline；优先 transform/opacity，并覆盖 Edge + 125% 缩放风险。");
}
if (/审查|交付|review|检查|验收/i.test(prompt)) {
  hints.push("交付前使用 command: delivery-review，覆盖功能归属、扩展性、必要重构和文档同步。");
}

if (hints.length === 0) {
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: `Light_line 工作流提示：\n- ${hints.join("\n- ")}`
  }
}));
