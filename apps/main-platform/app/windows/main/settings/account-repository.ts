import { MIA_RAG_TOKEN_KEY } from "../../../lib/client/auth-adapter";
import {
  normalizeAccountProfile,
  type AccountProfile,
  type PasswordForm,
} from "./account-settings";

type RequestOptions = RequestInit;

function getToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(MIA_RAG_TOKEN_KEY);
}

function getHeaders(headers?: HeadersInit) {
  const next = new Headers(headers);
  next.set("Accept", "application/json");
  const token = getToken();
  if (token) {
    next.set("Authorization", `Bearer ${token}`);
  }
  return next;
}

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: { message?: unknown }; detail?: unknown };
    if (typeof body.error?.message === "string") {
      return body.error.message;
    }
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Preserve the stable fallback for empty or non-JSON upstream errors.
  }
  return fallback;
}

async function requestJson<T>(input: RequestInfo | URL, options: RequestOptions = {}) {
  const response = await fetch(input, {
    ...options,
    headers: getHeaders(options.headers),
  });
  if (!response.ok) {
    throw new Error(await readError(response, "账户服务暂不可用"));
  }
  return response.json() as Promise<T>;
}

export const accountRepository = {
  async getProfile(fallback: Partial<AccountProfile> = {}) {
    const payload = await requestJson<unknown>("/api/account/me", {
      cache: "no-store",
    });
    return normalizeAccountProfile(payload, fallback);
  },

  async updateProfile(displayName: string, fallback: Partial<AccountProfile> = {}) {
    const payload = await requestJson<unknown>("/api/account/me", {
      body: JSON.stringify({ display_name: displayName }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    return normalizeAccountProfile(payload, fallback);
  },

  async uploadAvatar(file: File, fallback: Partial<AccountProfile> = {}) {
    const formData = new FormData();
    formData.set("avatar", file);
    const payload = await requestJson<unknown>("/api/account/avatar", {
      body: formData,
      method: "POST",
    });
    return normalizeAccountProfile(payload, fallback);
  },

  async removeAvatar(fallback: Partial<AccountProfile> = {}) {
    const payload = await requestJson<unknown>("/api/account/avatar", {
      method: "DELETE",
    });
    return normalizeAccountProfile(payload, fallback);
  },

  async changePassword(form: PasswordForm) {
    await requestJson<unknown>("/api/account/password", {
      body: JSON.stringify({
        current_password: form.currentPassword,
        new_password: form.newPassword,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  },

  async logout() {
    const token = getToken();
    if (token) {
      await requestJson<unknown>("/api/account/logout", { method: "POST" });
    }
    window.localStorage.removeItem(MIA_RAG_TOKEN_KEY);
  },
};

export function getStoredAccountToken() {
  return getToken();
}
