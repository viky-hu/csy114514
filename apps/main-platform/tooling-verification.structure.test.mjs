import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const appRoot = new URL("./", import.meta.url);

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, appRoot), "utf8"));
}

function readText(path, base = appRoot) {
  return readFileSync(new URL(path, base), "utf8");
}

test("main-platform exposes stable daily verification scripts", () => {
  const packageJson = readJson("package.json");

  assert.equal(packageJson.scripts["type-check"], "pnpm run type-check:app");
  assert.equal(packageJson.scripts["type-check:app"], "tsc -p tsconfig.app.json --noEmit");
  assert.equal(packageJson.scripts["type-check:test"], "tsc -p tsconfig.test.json --noEmit");
  assert.equal(packageJson.scripts["verify:default"], "pnpm run type-check:app && pnpm run lint && pnpm run build");
  assert.equal(packageJson.scripts["verify:full"], "pnpm run type-check:app && pnpm run type-check:test && pnpm run lint && pnpm run build");
  assert.equal(packageJson.devDependencies["@next/eslint-plugin-next"], "16.3.1");
  assert.equal(packageJson.devDependencies["typescript-eslint"], "8.67.0");
});

test("TypeScript configs separate application and Node test checks", () => {
  assert.equal(existsSync(new URL("tsconfig.app.json", appRoot)), true);
  assert.equal(existsSync(new URL("tsconfig.test.json", appRoot)), true);

  const appConfig = readJson("tsconfig.app.json");
  const testConfig = readJson("tsconfig.test.json");

  assert.deepEqual(appConfig.include, ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx"]);
  assert.deepEqual(appConfig.compilerOptions.types, ["node"]);
  assert.ok(appConfig.exclude.includes("**/*.test.*"));
  assert.ok(appConfig.exclude.includes("**/*.structure.test.*"));
  assert.ok(appConfig.exclude.includes(".next/**"));

  assert.deepEqual(testConfig.compilerOptions.types, ["node"]);
  assert.equal(testConfig.compilerOptions.module, "ESNext");
  assert.equal(testConfig.compilerOptions.moduleResolution, "Bundler");
  assert.ok(testConfig.include.includes("app/**/*.test.ts"));
  assert.ok(testConfig.exclude.includes(".next/**"));
});

test("tooling discipline documents the stable verification boundary", () => {
  const agents = readText("AGENTS.md", root);
  const checklist = readText("docs/architecture/extension-review-checklist.md", root);

  assert.match(agents, /verify:default/);
  assert.match(agents, /type-check:app/);
  assert.match(agents, /type-check:test/);
  assert.match(agents, /verify:full/);
  assert.match(checklist, /Stable Verification Tooling/);
});
