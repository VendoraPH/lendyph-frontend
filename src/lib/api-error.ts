// Single source of truth for turning any thrown value into safe, friendly,
// non-technical copy. Pure and dependency-free so it is unit-testable via tsx.
//
// Detection is structural (checks `err.response.status`) rather than
// `instanceof AxiosError`, which is fragile when axios is bundled more than once.

export interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

interface HttpErrorShape {
  response?: { status?: number; data?: ApiErrorBody };
}

function asHttpError(err: unknown): HttpErrorShape | null {
  if (err && typeof err === "object" && "response" in err) return err as HttpErrorShape;
  return null;
}

function bodyOf(err: unknown): ApiErrorBody | undefined {
  return asHttpError(err)?.response?.data;
}

export function getFieldErrors(err: unknown): string[] {
  const errors = bodyOf(err)?.errors;
  if (!errors) return [];
  return Object.values(errors)
    .flat()
    .filter((m): m is string => typeof m === "string" && m.length > 0);
}

export function firstFieldError(err: unknown): string | null {
  return getFieldErrors(err)[0] ?? null;
}

// Laravel's stock exception bodies are short, plain English with no internals,
// so `looksHuman` below waves them through — and the framework's wording then
// beats our own friendlier copy for the same status. "Too Many Attempts." is
// the one that reached members: it won over STATUS_COPY[429] and shipped
// verbatim to a toast.
//
// Anchored to the WHOLE trimmed string (with an optional trailing period) on
// purpose. These are also ordinary words, and real prose that merely contains
// one — "Editing is forbidden while the loan is under review." — must still be
// shown. Only the bare framework default is rejected, which lets a
// hand-written body for the same status (e.g. a rate-limit message carrying a
// retry-time hint) through untouched.
const FRAMEWORK_BOILERPLATE =
  /^(too many attempts|unauthenticated|unauthorized|forbidden|server error|not found|this action is unauthorized)\.?$/i;

// Reject strings that are clearly technical or internal rather than user copy,
// so a raw backend/Axios message can never leak to the UI.
//
// `No query results for model [App\Models\Loan] 42` and bare class paths are
// called out explicitly: Laravel emits them for a failed route-model binding,
// and they read as plausible prose to a naive filter while meaning nothing to a
// user. They must never reach the UI now that 404 can surface a server message.
function looksHuman(msg: string | undefined): msg is string {
  if (!msg || typeof msg !== "string") return false;
  const text = msg.trim();
  if (!text) return false;
  if (FRAMEWORK_BOILERPLATE.test(text)) return false;
  return !/status code|network error|axios|force=true|sqlstate|exception|undefined|null|econn|timeout of|\bstack\b|no query results|\\|::|\bclass\b|\bat line\b/i.test(
    text
  );
}

// Statuses where the server may legitimately explain WHY, in copy written for a
// user. Without this the explanation is thrown away and replaced by generic
// text: a restructure blocked by dual control reported "You don't have
// permission to do that", which sends people to check their roles instead of
// noticing they were the one who created the loan.
//
// 401 and 5xx are deliberately excluded — a session expiry is never better
// explained by the server, and a 500 body is exactly where internals leak.
const STATUSES_THAT_MAY_EXPLAIN = new Set([403, 404, 409, 413, 429]);

const STATUS_COPY: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That action conflicts with the current state. Refresh and try again.",
  413: "That file is too large. Please upload a smaller file.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again in a moment.",
  502: "Something went wrong on our end. Please try again in a moment.",
  503: "Something went wrong on our end. Please try again in a moment.",
  504: "Something went wrong on our end. Please try again in a moment.",
};

const GENERIC = "Something went wrong. Please try again.";
const OFFLINE = "You appear to be offline. Check your connection and try again.";
const TIMEOUT =
  "That took longer than expected, and your submission may still have gone through. Please wait a moment and check before trying again.";
const VALIDATION = "Please review the highlighted details and try again.";

// Axios puts its failure code on the error itself, NOT under `response` — and a
// timed-out request has no `response` at all, so this has to read the raw
// thrown value rather than the narrowed HTTP shape.
const TIMEOUT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT"]);

function isTimeout(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("code" in err)) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && TIMEOUT_CODES.has(code.toUpperCase());
}

/**
 * Turn any thrown value into a safe, friendly message.
 *
 * Priority: server message (only where the status may carry an explanation and
 * the text passes the human check) > fixed status-code copy > caller fallback.
 * Never returns a raw Axios/Error message or an internal backend flag.
 */
export function getErrorMessage(err: unknown, fallback: string = GENERIC): string {
  const http = asHttpError(err);

  // No HTTP response at all: a genuine offline, a DNS failure, a CORS block —
  // and a timeout, which axios reports identically. They need opposite advice.
  // "You appear to be offline" tells someone whose request timed out mid-upload
  // that nothing was sent, so they resubmit immediately; that is how a member
  // on a slow mobile connection ended up registered twice. A timeout means the
  // request left the device and may well have been processed, so say so and ask
  // them to wait rather than retry.
  if (!http || http.response?.status == null) {
    return isTimeout(err) ? TIMEOUT : OFFLINE;
  }

  const status = http.response.status;
  const body = http.response.data;

  // Validation statuses: prefer the specific field/message the server gave.
  if (status === 422 || status === 400) {
    const field = firstFieldError(err);
    if (field && looksHuman(field)) return field;
    if (looksHuman(body?.message)) return body!.message!;
    return VALIDATION;
  }

  // Where the server may explain itself, prefer its wording over the generic
  // copy — but only if it reads like something written for a person.
  if (STATUSES_THAT_MAY_EXPLAIN.has(status) && looksHuman(body?.message)) {
    return body!.message!;
  }

  // Known status → fixed friendly copy.
  if (STATUS_COPY[status]) return STATUS_COPY[status];

  // Unknown status: only surface the server message if it reads like human copy.
  if (looksHuman(body?.message)) return body!.message!;
  return fallback;
}
