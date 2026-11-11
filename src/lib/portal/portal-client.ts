import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { parseTokenLifetime, tokenLifetime, type TokenLifetime } from "@/lib/session-token";
import { PORTAL_ENDPOINTS, PORTAL_PUBLIC_PATHS } from "./endpoints";

/**
 * The member portal's own HTTP client (carried over from #511 by Augustin,
 * moved to sessionStorage).
 *
 * Deliberately separate from `axios-client.ts`, which it never imports: a
 * member token and a staff token must never be sent in each other's place. A
 * staff member who is also a member can be signed in to both in one browser,
 * so each keeps its own storage, its own 401 handling and its own "session
 * ended" event.
 *
 * - The token lives in `sessionStorage` only (portal design §1): it dies with
 *   the tab and never touches the staff app's `localStorage` keys.
 * - Nothing here renews a token. A member session runs to the server's
 *   `session_minutes`, and the server ends an idle one (`session_idle`).
 */

export const PORTAL_TOKEN_KEY = "lendy_member_token";
const LIFETIME_KEY = `${PORTAL_TOKEN_KEY}_lifetime`;
const NOTICE_KEY = "lendy_member_notice";
/** Only when the server sends no `expires_in`: the portal's default session. */
const DEFAULT_SESSION_MINUTES = 60;

/** Dispatched on `window` when the member's session ends; the layout signs out. */
export const PORTAL_SESSION_ENDED_EVENT = "portal:session-ended";
/** Dispatched on `window` when the server asks for the new terms first. */
export const PORTAL_TERMS_REQUIRED_EVENT = "portal:terms-required";

function store(): Storage | null {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

export const portalTokens = {
  get(): string | null {
    return store()?.getItem(PORTAL_TOKEN_KEY) ?? null;
  },
  set(token: string, expiresIn?: unknown): void {
    const s = store();
    if (!s) return;
    s.setItem(PORTAL_TOKEN_KEY, token);
    s.setItem(LIFETIME_KEY, JSON.stringify(tokenLifetime(expiresIn, Date.now(), DEFAULT_SESSION_MINUTES)));
    s.removeItem(NOTICE_KEY);
    markActivity();
  },
  lifetime(): TokenLifetime | null {
    return parseTokenLifetime(store()?.getItem(LIFETIME_KEY) ?? null);
  },
  clear(): void {
    const s = store();
    s?.removeItem(PORTAL_TOKEN_KEY);
    s?.removeItem(LIFETIME_KEY);
  },
};

/** Why the last session ended, for the sign-in page to say once. */
export const portalNotice = {
  set(message: string): void {
    store()?.setItem(NOTICE_KEY, message);
  },
  read(): string | null {
    return store()?.getItem(NOTICE_KEY) ?? null;
  },
  /** Forgotten once the member signs in again. */
  clear(): void {
    store()?.removeItem(NOTICE_KEY);
  },
};

let lastActivityAt = 0;

/** The time of the member's last call to the API, which keeps the server's idle window open. */
export function lastActivity(): number {
  return lastActivityAt;
}

function markActivity(): void {
  lastActivityAt = Date.now();
}

/** What the member reads when the server ends the session, by the server's code. */
export const SESSION_END_WORDS: Readonly<Record<string, string>> = {
  session_idle: "You were signed out after a period of inactivity. Please sign in again.",
  portal_access_disabled: "Your portal access is turned off. Please contact your branch.",
  portal_account_locked: "Your portal account is locked. Please contact your branch.",
  membership_inactive: "Your membership isn't active, so you can't use the portal right now. Please contact your branch.",
  portal_off: "The member portal is not available right now.",
};
const SESSION_ENDED = "Your session has ended. Please sign in again.";

/** Refusals after which the server has already deleted the token. */
const ENDING_CODES = new Set(["portal_access_disabled", "portal_account_locked", "membership_inactive", "portal_off"]);

/** Ends the member's session in this tab, with the words the sign-in page will show. */
export function endPortalSession(message: string = SESSION_ENDED): void {
  portalTokens.clear();
  portalNotice.set(message);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PORTAL_SESSION_ENDED_EVENT));
}

function apiBase(): string {
  if (typeof window !== "undefined") return "/api/proxy";
  return process.env.NEXT_PUBLIC_API_URL || env.api.baseUrl;
}

/**
 * A public file the portal's config names by API path (`logo_url`, the
 * branding logo), as an address the browser loads by itself: a plain
 * same-origin image request through the proxy, with no token and no staff
 * client. Anything that isn't a plain path is refused.
 */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (typeof path !== "string" || !/^\/[A-Za-z0-9/_.-]*$/.test(path) || path.startsWith("//") || path.includes("..")) return null;
  return `${apiBase().replace(/\/$/, "")}${path}`;
}

/** The raw axios instance. Exported for the tests only; screens use `portalApi`. */
export const portalHttp = axios.create({
  baseURL: apiBase(),
  timeout: env.api.timeout,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

/** The one call that may carry a token the tab has already forgotten: signing out. */
const SIGN_OUT_TOKEN = "portalSignOutToken";
type SignOutConfig = InternalAxiosRequestConfig & { [SIGN_OUT_TOKEN]?: string };

portalHttp.interceptors.request.use((config) => {
  const token = (config as SignOutConfig)[SIGN_OUT_TOKEN] ?? portalTokens.get();
  // Set or removed on every request, so nothing but the member's own token
  // (from sessionStorage) can ever ride along.
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  else config.headers.delete("Authorization");
  return config;
});

function isPublicPath(url: string): boolean {
  const path = url.split("?")[0];
  return PORTAL_PUBLIC_PATHS.includes(path);
}

portalHttp.interceptors.response.use(
  (response) => {
    if (!isPublicPath(response.config.url ?? "")) markActivity();
    return response;
  },
  (error) => {
    const url: string = error?.config?.url ?? "";
    const status: number | undefined = error?.response?.status;
    const code: unknown = error?.response?.data?.code;
    if (!isPublicPath(url) && portalTokens.get() !== null) {
      if (status === 401) {
        endPortalSession(SESSION_END_WORDS[typeof code === "string" ? code : ""] ?? SESSION_ENDED);
      } else if ((status === 403 || status === 503) && typeof code === "string" && ENDING_CODES.has(code)) {
        endPortalSession(SESSION_END_WORDS[code]);
      } else if (status === 403 && code === "terms_required" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PORTAL_TERMS_REQUIRED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

interface Envelope<T> {
  success?: boolean;
  data: T;
  meta?: unknown;
}

/** A write's HTTP status with its unwrapped `data`, for callers that must see 201 or 202. */
export interface Confirmed<T> {
  status: number;
  data: T;
}

/** A downloaded file and the name the server gave it. */
export interface DownloadedFile {
  blob: Blob;
  filename: string | null;
}

/** The file name in a `Content-Disposition` header, if any. */
export function filenameFrom(disposition: unknown): string | null {
  if (typeof disposition !== "string") return null;
  const star = /filename[*]=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : null;
}

const unwrap = <T>(response: AxiosResponse<Envelope<T>>): T => response.data.data;

/** Same shape as `api` in lib/api-client.ts, on the portal's own client. */
export const portalApi = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    unwrap(await portalHttp.get<Envelope<T>>(url, config)),
  /** The whole body, for paged lists whose `meta` matters. */
  getPage: async <T, M = object>(url: string, config?: AxiosRequestConfig) =>
    (await portalHttp.get<{ data: T[]; meta: M }>(url, config)).data,
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    unwrap(await portalHttp.post<Envelope<T>>(url, body, config)),
  /** A write whose caller must see the status (201, 202) before it says it worked. */
  postConfirmed: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<Confirmed<T>> => {
    const response = await portalHttp.post<Envelope<T>>(url, body, config);
    return { status: response.status, data: response.data.data };
  },
  deleteConfirmed: async <T>(url: string, config?: AxiosRequestConfig): Promise<Confirmed<T>> => {
    const response = await portalHttp.delete<Envelope<T>>(url, config);
    return { status: response.status, data: response.data.data };
  },
  download: async (url: string, config?: AxiosRequestConfig): Promise<DownloadedFile> => {
    const response = await portalHttp.get<Blob>(url, { ...config, responseType: "blob" });
    return { blob: response.data, filename: filenameFrom(response.headers?.["content-disposition"]) };
  },
};

/** How long signing out waits for the server before giving up (best effort). */
export const SIGN_OUT_TIMEOUT_MS = 5_000;

/**
 * Asks the server to end the session of `token`, which the tab has usually
 * forgotten already, so the member is signed out here whatever the answer.
 */
export function logoutWith(token: string): Promise<unknown> {
  const config = { timeout: SIGN_OUT_TIMEOUT_MS, [SIGN_OUT_TOKEN]: token } as AxiosRequestConfig;
  return portalHttp.post(PORTAL_ENDPOINTS.LOGOUT, undefined, config);
}
