export type AccountProfile = {
  username: string;
  displayName: string;
  role: string | null;
  nodeType: string | null;
  avatarUrl: string | null;
  passwordUpdatedAt?: string | null;
};

export type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const SUPPORTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAccountProfile(
  value: unknown,
  fallback: Partial<AccountProfile> = {},
): AccountProfile {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nested = source.user && typeof source.user === "object"
    ? source.user as Record<string, unknown>
    : {};
  const username = readString(source.username) || readString(nested.username) || fallback.username || "未登录账号";
  const displayName =
    readString(source.display_name) ||
    readString(source.displayName) ||
    readString(nested.display_name) ||
    readString(nested.displayName) ||
    fallback.displayName ||
    username;

  return {
    username,
    displayName,
    role: readString(source.role) || readString(nested.role) || fallback.role || null,
    nodeType: readString(source.node_type) || readString(source.nodeType) || readString(nested.node_type) || fallback.nodeType || null,
    avatarUrl: readString(source.avatar_url) || readString(source.avatarUrl) || readString(nested.avatar_url) || fallback.avatarUrl || null,
    passwordUpdatedAt: readString(source.password_updated_at) || readString(source.passwordUpdatedAt) || fallback.passwordUpdatedAt || null,
  };
}

export function areProfileValuesDirty(
  profile: AccountProfile,
  values: { displayName: string },
) {
  return profile.displayName !== values.displayName.trim();
}

export function validatePasswordForm(form: PasswordForm): ValidationResult {
  if (!form.currentPassword.trim() || !form.newPassword.trim() || !form.confirmPassword.trim()) {
    return { ok: false, message: "请完整填写密码字段" };
  }

  if (form.newPassword !== form.confirmPassword) {
    return { ok: false, message: "两次输入的新密码不一致" };
  }

  return { ok: true };
}

export function validateAvatarFile(file: Pick<File, "type" | "size">): ValidationResult {
  if (!SUPPORTED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, message: "头像仅支持 JPG、PNG 或 WebP 图片" };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "头像文件不能超过 2MB" };
  }

  return { ok: true };
}

export function getAccountStatusMessage(error: unknown, fallback = "账户服务暂不可用") {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
