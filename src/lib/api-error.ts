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

// Reject strings that are clearly technical or internal rather than user copy,
// so a raw backend/Axios message can never leak to the UI.
//
// `No query results for model [App\Models\Loan] 42` and bare class paths are
// called out explicitly: Laravel emits them for a failed route-model binding,
// and they read as plausible prose to a naive filter while meaning nothing to a
// user. They must never reach the UI now that 404 can surface a server message.
function looksHuman(msg: string | undefined): msg is string {
  if (!msg || typeof msg !== "string") return false;
  return !/status code|network error|axios|force=true|sqlstate|exception|undefined|null|econn|timeout of|\bstack\b|no query results|\\|::|\bclass\b|\bat line\b/i.test(
    msg
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
const VALIDATION = "Please review the highlighted details and try again.";

/**
 * Turn any thrown value into a safe, friendly message.
 *
 * Priority: server message (only where the status may carry an explanation and
 * the text passes the human check) > fixed status-code copy > caller fallback.
 * Never returns a raw Axios/Error message or an internal backend flag.
 */
export function getErrorMessage(err: unknown, fallback: string = GENERIC): string {
  const http = asHttpError(err);

  // No HTTP response at all → network/offline (or a non-Axios throw).
  if (!http || http.response?.status == null) {
    return OFFLINE;
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
