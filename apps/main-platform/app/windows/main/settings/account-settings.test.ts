import assert from "node:assert/strict";
import test from "node:test";

import {
  areProfileValuesDirty,
  validateAvatarFile,
  validatePasswordForm,
  type AccountProfile,
} from "./account-settings.ts";

const profile: AccountProfile = {
  username: "chen-shuyang",
  displayName: "陈书扬",
  role: "admin",
  nodeType: "center",
  avatarUrl: null,
};

test("profile values are dirty only when the display name changes", () => {
  assert.equal(areProfileValuesDirty(profile, { displayName: "陈书扬" }), false);
  assert.equal(areProfileValuesDirty(profile, { displayName: "全智赛管理员" }), true);
  assert.equal(areProfileValuesDirty(profile, { displayName: "  陈书扬  " }), false);
});

test("password validation requires all fields and matching new passwords", () => {
  assert.deepEqual(validatePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }), {
    ok: false,
    message: "请完整填写密码字段",
  });
  assert.deepEqual(validatePasswordForm({ currentPassword: "old-pass", newPassword: "new-pass", confirmPassword: "different" }), {
    ok: false,
    message: "两次输入的新密码不一致",
  });
  assert.deepEqual(validatePasswordForm({ currentPassword: "old-pass", newPassword: "new-pass", confirmPassword: "new-pass" }), {
    ok: true,
  });
});

test("avatar validation accepts supported images under 2 MB", () => {
  assert.deepEqual(validateAvatarFile({ type: "image/png", size: 1024 }), { ok: true });
  assert.deepEqual(validateAvatarFile({ type: "image/svg+xml", size: 1024 }), {
    ok: false,
    message: "头像仅支持 JPG、PNG 或 WebP 图片",
  });
  assert.deepEqual(validateAvatarFile({ type: "image/jpeg", size: 2 * 1024 * 1024 + 1 }), {
    ok: false,
    message: "头像文件不能超过 2MB",
  });
});
