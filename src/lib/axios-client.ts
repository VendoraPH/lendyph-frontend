import axios from "axios";
import { env } from "@/config/env";
import {
  isPasswordChangeRequiredError,
  PASSWORD_CHANGE_REQUIRED_EVENT,
} from "./password-change-required";

const DIRECT_API_URL = process.env.NEXT_PUBLIC_API_URL || env.api.baseUrl;

// Use Next.js API proxy on client-side to bypass CORS/CSRF issues
// Server-side (SSR) calls go direct to the API.
//
// Exported because anything else fetching the API from the browser needs the
// same same-origin path — a direct fetch to the API host is a cross-origin
// request and will not carry auth or, for /storage/**, any CORS header at all.
export const API_BASE_URL =
  typeof window !== "undefined" ? "/api/proxy" : DIRECT_API_URL;

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: env.api.timeout,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export const tokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(env.auth.tokenKey);
  },
  setAccessToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(env.auth.tokenKey, token);
  },
  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(env.auth.refreshTokenKey);
  },
  setRefreshToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(env.auth.refreshTokenKey, token);
  },
  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(env.auth.tokenKey);
    localStorage.removeItem(env.auth.refreshTokenKey);
  },
};

// Request interceptor — attach token
// Public-registration uploads identify themselves with X-Submission-Token.
// In that case we must NOT attach a Bearer token, otherwise a stale admin
// session in localStorage gets forwarded and the backend rejects the
// request with 401.
const SUBMISSION_TOKEN_HEADER = "X-Submission-Token";

function hasSubmissionToken(config: { headers?: unknown }): boolean {
  const headers = config.headers as Record<string, unknown> | undefined;
  if (!headers) return false;
  return Boolean(headers[SUBMISSION_TOKEN_HEADER] ?? headers[SUBMISSION_TOKEN_HEADER.toLowerCase()]);
}

axiosClient.interceptors.request.use(
  (config) => {
    if (hasSubmissionToken(config)) {
      return config;
    }
    const token = tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * A refresh that answered 200 but carried no usable token.
 *
 * Named so the catch below can tell it apart from a network error. Both arrive
 * as non-Axios throws with no `response.status`, but they mean opposite things:
 * a dropped connection says nothing about the session and the tokens should be
 * kept, whereas a 200 we cannot read a token out of means whatever answered is
 * not our API and the access token in hand is unusable.
 *
 * The live backend cannot produce this — AuthController::refresh() returns a
 * bare { token } — but a proxy, CDN or captive portal answering 200 with its
 * own body would. Without this the user keeps a dead token, sees no dialog, and
 * every later request 401s into a refresh that can never succeed.
 */
export class MalformedRefreshError extends Error {
  constructor(message = "Refresh response contained no access token") {
    super(message);
    this.name = "MalformedRefreshError";
  }
}

// Response interceptor — handle 401 + token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── 423: the password must be changed before anything else works ──
    //
    // Announced, then rethrown untouched, so the calling component's own catch
    // still runs and nothing swallows the failure. A listener (see
    // use-password-change-guard.ts) moves the user to /change-password, which
    // is why this dispatches an event instead of setting window.location — the
    // same reasoning as "auth:session-expired" below.
    //
    // It sits ABOVE the 401 handler rather than beside it to make one thing
    // unmissable to the next reader: a 423 must NEVER reach the refresh path.
    // `POST /auth/refresh` is not on the backend's allowlist while the flag is
    // set, so a refresh attempt would itself come back 423, and the catch down
    // there only treats 401/403/419 as a dead session — so the retry would
    // fail, the user would be left on a spinner, and nothing would ever say
    // why. As written the refresh block is already unreachable for a 423 (it
    // is gated on `status === 401`), so this changes no existing behaviour; it
    // guards the invariant against a later edit that widens that condition.
    if (isPasswordChangeRequiredError(error)) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PASSWORD_CHANGE_REQUIRED_EVENT));
      }
      return Promise.reject(error);
    }

    const isAuthRoute = originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/refresh");
    const isPublicSubmission = hasSubmissionToken(originalRequest ?? {});

    // If there is no access token in storage, the caller is anonymous (e.g. the
    // public /register page). A 401 here means the endpoint required auth or
    // doesn't allow anonymous access — refreshing a non-existent token would
    // just produce another 401 and a spurious "session expired" event.
    const hasAccessToken = tokenManager.getAccessToken() !== null;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute &&
      hasAccessToken &&
      !isPublicSubmission
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentToken = tokenManager.getAccessToken();
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${currentToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        // The API is inconsistent about the envelope: /auth/login answers with
        // a bare { token, user } (hence api.rawPost in auth.service) while most
        // routes wrap their payload in { success, data }. This call uses plain
        // axios, so nothing unwraps it for us — accept either shape.
        const newToken: unknown = data?.data?.token ?? data?.token;
        if (typeof newToken !== "string" || newToken.length === 0) {
          // Reading the token from the wrong depth used to yield undefined,
          // which localStorage stored as the string "undefined". Every later
          // request then sent `Bearer undefined`, 401'd, tried to refresh with
          // that same garbage, and logged the user out mid-session. Treat a
          // token we cannot find as a failed refresh instead.
          throw new MalformedRefreshError();
        }
        tokenManager.setAccessToken(newToken);

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Only an outright rejection means the session is really gone. A
        // dropped connection, a timeout, or a 500 says nothing about whether
        // the user is still signed in — treating those as a dead session
        // logged people out mid-task over a blip on the wire, and threw away
        // a set of tokens that were still perfectly good.
        const status = axios.isAxiosError(refreshError)
          ? refreshError.response?.status
          : undefined;
        // A malformed 200 is not a wire blip: it joins the outright
        // rejections, because the token we hold cannot be renewed by whatever
        // is answering.
        const sessionIsGone =
          status === 401 ||
          status === 403 ||
          status === 419 ||
          refreshError instanceof MalformedRefreshError;

        if (sessionIsGone) {
          tokenManager.clearTokens();
          // Instead of a hard redirect (window.location.href = "/login"),
          // dispatch a custom event so the SessionProvider can handle the
          // logout gracefully — showing a toast and cleaning up auth state
          // without jarring the user mid-action.
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("auth:session-expired"));
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
