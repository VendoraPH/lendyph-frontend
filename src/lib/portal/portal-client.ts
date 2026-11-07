import axios, { type AxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { API_BASE_URL } from "@/lib/axios-client";
import { parseTokenLifetime, tokenLifetime, type TokenLifetime } from "@/lib/session-token";

/**
 * The member portal's own HTTP client.
 *
 * Deliberately separate from `axios-client.ts`: a member token and a staff
 * token must never be sent in each other's place. A staff member who is also a
 * cooperative member can be signed in to both in one browser, so each keeps
 * its own storage key, its own 401 handling and its own "session ended" event.
 * Nothing here renews tokens: a member session simply runs to the portal's
 * configured length and then asks the member to sign in again.
 */

const TOKEN_KEY = "lendy_member_token";
const LIFETIME_KEY = `${TOKEN_KEY}_lifetime`;
/** Fallback when the API sends no `expires_in`. */
const DEFAULT_SESSION_MINUTES = 30;

export const PORTAL_SESSION_ENDED_EVENT = "portal:session-ended";

export const portalTokens = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string, expiresIn?: unknown): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(
      LIFETIME_KEY,
      JSON.stringify(tokenLifetime(expiresIn, Date.now(), DEFAULT_SESSION_MINUTES)),
    );
  },
  lifetime(): TokenLifetime | null {
    if (typeof window === "undefined") return null;
    return parseTokenLifetime(localStorage.getItem(LIFETIME_KEY));
  },
  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LIFETIME_KEY);
  },
};

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: env.api.timeout,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

client.interceptors.request.use((config) => {
  const token = portalTokens.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    // A wrong password on sign-in is a 401 too, and must not read as a
    // session ending.
    const isAuthStep = url.includes("/portal/auth/") && !url.includes("/portal/auth/me");
    if (error.response?.status === 401 && !isAuthStep && portalTokens.get() !== null) {
      portalTokens.clear();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PORTAL_SESSION_ENDED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

interface Envelope<T> {
  success?: boolean;
  data: T;
}

/** Same shape as `api` in lib/api-client.ts: unwraps `{ success, data }`. */
export const portalApi = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    (await client.get<Envelope<T>>(url, config)).data.data,
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    (await client.post<Envelope<T>>(url, body, config)).data.data,
  put: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    (await client.put<Envelope<T>>(url, body, config)).data.data,
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    (await client.delete<Envelope<T>>(url, config)).data.data,
  upload: async <T>(url: string, form: FormData): Promise<T> =>
    (
      await client.post<Envelope<T>>(url, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data.data,
  /** A file the member downloads (statement, receipt, certificate). */
  download: async (url: string, config?: AxiosRequestConfig): Promise<Blob> =>
    (await client.get(url, { ...config, responseType: "blob" })).data as Blob,
  /** The whole body, for paginated lists whose `meta` matters. */
  getRaw: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    (await client.get<T>(url, config)).data,
};
