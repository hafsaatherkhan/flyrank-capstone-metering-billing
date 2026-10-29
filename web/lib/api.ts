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
function setCookie(name: string, value: string, days: number = 7): void {
  if (typeof document === "undefined") return;
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

function removeCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return getCookie(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return getCookie(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setSessionTokens(access: string, refresh: string, user?: StoredUser): void {
  if (typeof window === "undefined") return;
  setCookie(ACCESS_TOKEN_KEY, access, 1);
  // Refresh token: cookie ONLY — do NOT put in localStorage (XSS risk)
  setCookie(REFRESH_TOKEN_KEY, refresh, 7);
  // Access token in localStorage is acceptable (60-min lifetime, low blast radius)
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
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
  clearStoredApiKey(); // clears both sessionStorage and localStorage API key
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  // Ensure sessionStorage is also cleared
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_DATA_KEY);
}

export interface ApiFetchOptions extends RequestInit {
  idempotencyKey?: string;
  _isRetry?: boolean; // internal flag to prevent infinite refresh loops
}

/**
 * Attempts to refresh the access token using the stored refresh token.
 * If successful, updates stored tokens and returns the new access token.
 * If refresh fails (token expired/revoked), clears session and redirects to login.
 */
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      // Refresh token is expired or revoked — force logout
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login?reason=session_expired";
      }
      return null;
    }

    const data = await res.json();
    setSessionTokens(data.access_token, data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
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

    // Auto-refresh on 401: JWT expired, try getting a new token
    if (res.status === 401 && !options._isRetry) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        // Retry the original request with the fresh token
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set("Content-Type", "application/json");
        if (apiKey) retryHeaders.set("X-API-Key", apiKey);
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
        if (options.idempotencyKey) retryHeaders.set("Idempotency-Key", options.idempotencyKey);

        return apiFetch<T>(endpoint, { ...options, headers: retryHeaders, _isRetry: true });
      }
      // tryRefreshToken already handled redirect if refresh also failed
      return { data: null, status: 401, headers: res.headers, error: "Session expired. Please log in again." };
    }

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
