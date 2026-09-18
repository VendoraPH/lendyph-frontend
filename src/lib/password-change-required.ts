// The "your password was reset, set a new one" lock, as pure predicates.
//
// When an administrator resets someone's password the backend sets a
// `must_change_password` flag on that user. While it is set, middleware answers
// **423 Locked** to every authenticated request except the three it allowlists:
// `GET /auth/me`, `POST /auth/change-password` and `POST /auth/logout`.
// `POST /auth/refresh` is NOT allowlisted — see the note in axios-client.ts.
//
// Dependency-free on purpose so it is unit-testable via `tsx --test`, and so
// axios-client.ts can import it without dragging React or the store in.

/**
 * The machine-readable contract. **Branch on this, never on `message`** — the
 * message is user-facing copy and will be reworded; the code is the API
 * contract.
 */
export const PASSWORD_CHANGE_REQUIRED_CODE = "password_change_required";

/**
 * Dispatched on `window` when any request comes back locked, so the app can
 * react from wherever the user happens to be. Mirrors the existing
 * `auth:session-expired` event rather than hard-redirecting from inside an
 * interceptor.
 */
export const PASSWORD_CHANGE_REQUIRED_EVENT = "auth:password-change-required";

/** Where a locked user is sent, and the only page they can use until they're not. */
export const CHANGE_PASSWORD_PATH = "/change-password";

/** Query param carrying the page they were blocked from, to resume afterwards. */
export const RETURN_PATH_PARAM = "next";

/** Where to land when there is no (or no safe) page to resume. */
export const DEFAULT_RETURN_PATH = "/dashboard";

interface LockedErrorBody {
  code?: unknown;
}

interface LockedErrorShape {
  response?: { status?: number; data?: LockedErrorBody };
}

/**
 * Is this thrown value the server telling us the password must be changed?
 *
 * Detection is structural rather than `instanceof AxiosError`, matching
 * api-error.ts — `instanceof` is unreliable when axios ends up bundled twice.
 *
 * A 423 carrying a *different* `code` is deliberately NOT treated as a lock:
 * that would be some future feature identifying itself, and hijacking it into
 * this screen would be wrong. A 423 carrying *no* code at all IS treated as a
 * lock, because 423 is used by nothing else in this API today and the two
 * failure modes are not symmetric — wrongly redirecting lands the user on a
 * screen that re-checks `/auth/me` and waves them straight back through, while
 * wrongly ignoring it leaves them staring at a toast with no way forward, which
 * is the exact dead end this feature exists to remove.
 */
export function isPasswordChangeRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("response" in err)) return false;
  const response = (err as LockedErrorShape).response;
  if (response?.status !== 423) return false;

  const code = response.data?.code;
  if (code == null) return true;
  return code === PASSWORD_CHANGE_REQUIRED_CODE;
}

/**
 * Sanitise a "send me back here afterwards" path taken from the URL.
 *
 * Next's own `useRouter` docs warn that an unsanitised string handed to
 * `router.push`/`replace` is an XSS vector (`javascript:` URLs execute), and
 * this value arrives in a query param anyone can craft. Only a same-origin
 * absolute path survives:
 *
 * - must start with a single `/` — rejects `javascript:`, `https://evil.tld`
 *   and, via the second character check, protocol-relative `//evil.tld`
 * - must not be the change-password screen itself, which would loop
 * - anything else collapses to the dashboard
 */
export function safeReturnPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_RETURN_PATH
): string {
  if (typeof raw !== "string") return fallback;
  const path = raw.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  // `/\evil.tld` is normalised to `//evil.tld` by some browsers.
  if (path.startsWith("/\\")) return fallback;
  if (path === CHANGE_PASSWORD_PATH || path.startsWith(`${CHANGE_PASSWORD_PATH}?`)) {
    return fallback;
  }
  return path;
}

/** Build the locked-screen URL, remembering where the user was headed. */
export function changePasswordUrl(returnPath?: string | null): string {
  const safe = safeReturnPath(returnPath, "");
  if (!safe) return CHANGE_PASSWORD_PATH;
  return `${CHANGE_PASSWORD_PATH}?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}`;
}
