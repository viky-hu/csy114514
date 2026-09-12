import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const presetsRoute = new URL("./presets/route.ts", import.meta.url);
const agentRoute = new URL("./[agentId]/route.ts", import.meta.url);

async function routeSource(route) {
  await access(route);
  return readFile(route, "utf8");
}

test("topology BFF exposes the preset route and preserves request cancellation", async () => {
  const source = await routeSource(presetsRoute);

  assert.match(source, /export async function GET/);
  assert.match(source, /buildAgentEvalBackendUrl\("\/topology\/presets"\)/);
  assert.match(source, /method: "GET"/);
  assert.match(source, /signal: request\.signal/);
  assert.match(source, /forwardJsonResponse\(upstream\)/);
});

test("topology BFF loads and saves an encoded agent topology through the backend", async () => {
  const source = await routeSource(agentRoute);

  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.match(source, /encodeURIComponent\(agentId\)/);
  assert.match(source, /buildAgentEvalBackendUrl\(`\/topology\/\$\{encodeURIComponent\(agentId\)\}`\)/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /body: await request\.text\(\)/);
  assert.match(source, /signal: request\.signal/);
  assert.match(source, /forwardJsonResponse\(upstream\)/);
});

