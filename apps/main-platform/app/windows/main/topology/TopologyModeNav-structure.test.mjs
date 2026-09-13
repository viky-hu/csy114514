import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = new URL("./TopologyModeNav.tsx", import.meta.url);
const styles = new URL("../../../styles/window-3-main.css", import.meta.url);

async function sourceOf(url) {
  return readFile(url, "utf8");
}

test("topology mode navigation keeps all three modes in a controlled accessible menu", async () => {
  const source = await sourceOf(component);

  assert.match(source, /Single Agent 模式/);
  assert.match(source, /Planner–Executor 模式/);
  assert.match(source, /RAG Agent 模式/);
  assert.match(source, /aria-current/);
  assert.match(source, /disabled=\{isCurrent\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /确认切换/);
  assert.match(source, /稍后再说/);
  assert.doesNotMatch(source, /MODE SWITCH/);
  assert.match(source, /onClick=\{onConfirmChange\}[\s\S]*?确认切换[\s\S]*?onClick=\{onDismissChange\}[\s\S]*?稍后再说/);
  assert.match(source, /onRequestChange/);
  assert.match(source, /onOpenChange\(false\)/);
});

test("topology mode navigation is an overlay and preserves warm responsive styling", async () => {
  const source = await sourceOf(styles);

  assert.match(source, /\.topology-mode-nav\s*\{[^}]*position:\s*absolute;/s);
  assert.match(source, /\.topology-mode-nav\s*\{[^}]*left:\s*50%;/s);
  assert.match(source, /\.topology-mode-nav\s*\{[^}]*transform:\s*translateX\(-50%\)/s);
  assert.match(source, /\.topology-mode-nav-card\.is-current\s*\{[^}]*cursor:\s*default;/s);
  assert.match(source, /@media \(max-width:\s*720px\)[\s\S]*?\.main-window\.has-topology-mode-nav \.main-window-brand-word\s*\{[^}]*display:\s*none;/s);
  assert.match(source, /\.topology-mode-nav-shell\s*\{[^}]*background:\s*rgba\(250, 248, 241, 0\.98\);/s);
  assert.match(source, /\.topology-mode-nav-card\.is-planner-executor\s*\{[^}]*background:\s*#deeee7;/s);
  assert.match(source, /\.topology-mode-nav-card\.is-single\s*\{[^}]*background:\s*#dce7fb;/s);
  assert.match(source, /\.topology-mode-nav-card\.is-rag-agent\s*\{[^}]*background:\s*#dcedf3;/s);
  assert.match(source, /\.topology-mode-nav-card\s*\{[^}]*color:\s*#2f3946;/s);
  assert.match(source, /\.topology-mode-nav-current\s*\{[^}]*color:\s*#536dff;/s);
  assert.match(source, /\.topology-mode-nav\s*\{[^}]*top:\s*clamp\(21px, 2\.7vh, 30px\);[^}]*opacity:\s*0;/s);
  assert.match(source, /\.topology-mode-nav-shell\s*\{[^}]*box-shadow:\s*0 5px 13px rgba\(67, 60, 42, 0\.05\);/s);
  assert.match(source, /\.topology-mode-nav-dialog\s*\{[^}]*border-top:\s*2px solid var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);[^}]*border-radius:\s*0;/s);
  assert.match(source, /\.topology-mode-nav-dialog\s*\{[^}]*font-family:\s*"DingTalk JinBuTi", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;/s);
  assert.match(source, /\.topology-mode-nav-dialog-actions button\s*\{[^}]*color:\s*var\(--evaluation-ink, #111622\);/s);
  assert.match(source, /\.topology-mode-nav-dialog-actions button:hover[^}]*background:\s*var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);[^}]*color:\s*white;/s);
});
