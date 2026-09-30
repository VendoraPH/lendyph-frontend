import axios from "axios";
import { env } from "@/config/env";
import {
  isPasswordChangeRequiredError,
  PASSWORD_CHANGE_REQUIRED_EVENT,
} from "./password-change-required";
import {
  bearerToken,
  isSessionRejection,
  parseTokenLifetime,
  tokenLifetime,
  unauthorizedOutcome,
  type TokenLifetime,
} from "./session-token";

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

// Stored beside the token so every tab, and a reload, knows when it expires.
const TOKEN_LIFETIME_KEY = `${env.auth.tokenKey}_lifetime`;

export const tokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(env.auth.tokenKey);
  },
  /**
   * Store a token the API just issued, with its `expires_in` (seconds) so the
   * session can renew it before it runs out. See lib/session-token.ts.
   */
  setAccessToken: (token: string, expiresIn?: unknown): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(env.auth.tokenKey, token);
    localStorage.setItem(
      TOKEN_LIFETIME_KEY,
      JSON.stringify(tokenLifetime(expiresIn, Date.now(), env.auth.sessionTimeout)),
    );
  },
  /** Null for a token stored before lifetimes were, or with no token at all. */
  getAccessTokenLifetime: (): TokenLifetime | null => {
    if (typeof window === "undefined") return null;
    return parseTokenLifetime(localStorage.getItem(TOKEN_LIFETIME_KEY));
  },
  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(env.auth.tokenKey);
    localStorage.removeItem(TOKEN_LIFETIME_KEY);
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
 * bare { token, expires_in } — but a proxy, CDN or captive portal answering 200
 * with its own body would. Without this the user keeps a token that can no
 * longer be renewed, sees no dialog, and is cut off when it expires.
 */
export class MalformedRefreshError extends Error {
  constructor(message = "Refresh response contained no access token") {
    super(message);
    this.name = "MalformedRefreshError";
  }
}

/**
 * End the session: drop the tokens and tell the SessionProvider, which shows
 * the "Session Expired" dialog. An event rather than a redirect, so the user
 * is told why before they are moved to /login.
 */
function endSession(): void {
  tokenManager.clearTokens();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:session-expired"));
  }
}

// One renewal at a time. Every caller that asks while one is in flight gets
// the same promise, so parallel callers can never rotate the token twice.
let renewal: Promise<string> | null = null;

/**
 * Swap the current access token for a fresh one, while it is still valid.
 *
 * Called ahead of expiry by the SessionProvider, never after a 401: the
 * refresh is authenticated by the token it replaces, so once that token is
 * rejected the refresh is rejected too. See lib/session-token.ts.
 */
export function renewAccessToken(): Promise<string> {
  if (!renewal) {
    renewal = rotateToken().finally(() => {
      renewal = null;
    });
  }
  return renewal;
}

async function rotateToken(): Promise<string> {
  const sent = tokenManager.getAccessToken();
  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${sent}`,
          "Content-Type": "application/json",
          Accept: "application/json",
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
      // request then sent `Bearer undefined` and 401'd. Treat a token we
      // cannot find as a failed renewal instead.
      throw new MalformedRefreshError();
    }
    tokenManager.setAccessToken(newToken, data?.data?.expires_in ?? data?.expires_in);
    return newToken;
  } catch (renewError) {
    // Another tab renewed first and rotated the token we sent out from
    // under us. Its replacement is already stored, so nothing is lost.
    const current = tokenManager.getAccessToken();
    if (current !== null && current !== sent) return current;

    // Only an outright rejection means the session is really gone. A
    // dropped connection, a timeout, or a 500 says nothing about whether
    // the user is still signed in. The token is kept and the next activity
    // tries again, while it is still valid.
    const status = axios.isAxiosError(renewError)
      ? renewError.response?.status
      : undefined;
    // A malformed 200 is not a wire blip: it joins the outright
    // rejections, because the token we hold cannot be renewed by whatever
    // is answering.
    const sessionIsGone =
      isSessionRejection(status) || renewError instanceof MalformedRefreshError;
    if (sessionIsGone) endSession();

    throw renewError;
  }
}

// Response interceptor — a 401 means the token that request carried is dead
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
    // It sits ABOVE the 401 handler to make one thing unmissable to the next
    // reader: a 423 must NEVER end the session or reach a token renewal.
    // `POST /auth/refresh` is not on the backend's allowlist while the flag
    // is set, so a renewal would itself come back 423.
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
    // public /register page), or an earlier 401 has already ended the session.
    // Either way there is no session left here to end.
    const hasAccessToken = tokenManager.getAccessToken() !== null;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRoute &&
      hasAccessToken &&
      !isPublicSubmission
    ) {
      originalRequest._retry = true;

      // A renewal in flight rotates the token this request may have carried.
      // Its own failure is handled inside it, so only the outcome matters.
      if (renewal) {
        await renewal.catch(() => undefined);
      }

      // Every 401 from this API means the token the request carried is dead.
      // There is deliberately no refresh here: the refresh is authenticated
      // by that same token and would be rejected too, which is exactly how
      // one expired token used to produce a 401 on every request AND on
      // /auth/refresh. If the token has been rotated since the request went
      // out, replay it with the new one; otherwise the session is over.
      const current = tokenManager.getAccessToken();
      if (unauthorizedOutcome(bearerToken(originalRequest.headers?.Authorization), current) === "replay") {
        originalRequest.headers.Authorization = `Bearer ${current}`;
        return axiosClient(originalRequest);
      }

      // A renewal that failed while this request waited may already have
      // ended it; the dialog only needs telling once.
      if (current !== null) endSession();
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
