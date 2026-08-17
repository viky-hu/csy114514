import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);

test("account BFF keeps the upstream auth URL server-side", async () => {
  const [route, auth] = await Promise.all([
    readFile(new URL("./me/route.ts", root), "utf8"),
    readFile(new URL("../../lib/server/account-auth.ts", root), "utf8"),
  ]);
  assert.match(auth, /process\.env\.MIA_RAG_AUTH_URL/);
  assert.doesNotMatch(auth, /NEXT_PUBLIC_MIA_RAG_AUTH_URL/);
  assert.match(route, /forwardJsonResponse/);
});

test("account BFF exposes profile, avatar, password, and logout methods", async () => {
  const [profile, avatar, password, logout] = await Promise.all([
    readFile(new URL("./me/route.ts", root), "utf8"),
    readFile(new URL("./avatar/route.ts", root), "utf8"),
    readFile(new URL("./password/route.ts", root), "utf8"),
    readFile(new URL("./logout/route.ts", root), "utf8"),
  ]);
  assert.match(profile, /export async function GET/);
  assert.match(profile, /export async function PATCH/);
  assert.match(profile, /\/api\/auth\/profile/);
  assert.match(avatar, /export async function POST/);
  assert.match(avatar, /export async function DELETE/);
  assert.match(password, /export async function POST/);
  assert.match(password, /\/api\/auth\/password/);
  assert.match(logout, /export async function POST/);
  assert.match(logout, /\/api\/auth\/logout/);
});
