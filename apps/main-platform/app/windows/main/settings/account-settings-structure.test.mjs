import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);

test("settings is a focused account center connected to MainWindow", async () => {
  const [workspace, mainWindow] = await Promise.all([
    readFile(new URL("./AccountSettingsWorkspace.tsx", root), "utf8"),
    readFile(new URL("../MainWindow.tsx", root), "utf8"),
  ]);

  assert.match(mainWindow, /activeNavKey === "setting"/);
  assert.match(mainWindow, /<AccountSettingsWorkspace/);
  assert.match(mainWindow, /english: "账号中心"/);
  assert.match(workspace, />个人资料</);
  assert.match(workspace, />账户安全</);
  assert.match(workspace, />账户操作</);
  assert.doesNotMatch(workspace, /主题|语言|通知|显示偏好|Agent 配置/);
});

test("profile keeps credentials read-only and logout clears evaluation state", async () => {
  const workspace = await readFile(new URL("./AccountSettingsWorkspace.tsx", root), "utf8");

  assert.match(workspace, /<span>登录账号<\/span><input readOnly/);
  assert.match(workspace, /<span>账号角色<\/span><strong>/);
  assert.match(workspace, /clearEvaluationWorkspaceSession\(\)/);
  assert.match(workspace, /localStorage\.removeItem\("mia_rag_token"\)/);
  assert.match(workspace, /不会删除 Agent、测评运行或报告数据/);
});

test("password dialog and page choreography preserve accessibility and reduced motion", async () => {
  const [dialog, workspace, styles] = await Promise.all([
    readFile(new URL("./AccountPasswordDialog.tsx", root), "utf8"),
    readFile(new URL("./AccountSettingsWorkspace.tsx", root), "utf8"),
    readFile(new URL("../../../styles/window-3-main.css", root), "utf8"),
  ]);

  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /autoComplete="current-password"/);
  assert.match(dialog, /autoComplete="new-password"/);
  assert.match(workspace, /stagger: 0\.06/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.account-settings-reveal[\s\S]*opacity: 1/);
});

test("avatar selection opens a constrained crop dialog before profile upload", async () => {
  const [workspace, dialog, repository] = await Promise.all([
    readFile(new URL("./AccountSettingsWorkspace.tsx", root), "utf8"),
    readFile(new URL("./AccountAvatarCropDialog.tsx", root), "utf8"),
    readFile(new URL("./account-repository.ts", root), "utf8"),
  ]);

  assert.match(workspace, /<AccountAvatarCropDialog/);
  assert.match(workspace, /event\.target\.value = ""/);
  assert.match(dialog, /from "react-easy-crop"/);
  assert.match(dialog, /aspect=\{1\}/);
  assert.match(dialog, /minZoom=\{1\}/);
  assert.match(dialog, /maxZoom=\{3\.2\}/);
  assert.match(dialog, /restrictPosition/);
  assert.match(dialog, /window\.setTimeout/);
  assert.match(dialog, /80/);
  assert.match(repository, /body: formData/);
});
