export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export const DEMO_API_KEY =
  process.env.NEXT_PUBLIC_DEMO_API_KEY || "";

const KEY_STORAGE_NAME = "hisaabledger_api_key";
const ACCESS_TOKEN_KEY = "hisaabledger_access_token";
const REFRESH_TOKEN_KEY = "hisaabledger_refresh_token";
const USER_DATA_KEY = "hisaabledger_user_data";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  tenant_id?: string | null;
}

// ----------------- API Key Helpers -----------------
export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY_STORAGE_NAME) || localStorage.getItem(KEY_STORAGE_NAME);
}

export function setStoredApiKey(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_STORAGE_NAME, key);
  localStorage.setItem(KEY_STORAGE_NAME, key);
}

export function clearStoredApiKey(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_STORAGE_NAME);
  localStorage.removeItem(KEY_STORAGE_NAME);
}

// ----------------- Session & Tokens Helpers -----------------
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSessionTokens(access: string, refresh: string, user?: StoredUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  if (user) {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  }
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  clearStoredApiKey();
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
}

export interface ApiFetchOptions extends RequestInit {
  idempotencyKey?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T | null; status: number; headers: Headers; error?: string }> {
  const apiKey = getStoredApiKey();
  const token = getAccessToken();
  const url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      let errMsg = `Request failed (${res.status})`;
      if (data && typeof data === "object") {
        if ("detail" in data) {
          errMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        } else if ("error" in data) {
          errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        }
      }
      return { data: null, status: res.status, headers: res.headers, error: errMsg };
    }

    return { data: data as T, status: res.status, headers: res.headers };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    return { data: null, status: 0, headers: new Headers(), error: message };
  }
}
