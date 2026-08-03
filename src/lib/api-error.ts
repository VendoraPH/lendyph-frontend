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
function looksHuman(msg: string | undefined): msg is string {
  if (!msg || typeof msg !== "string") return false;
  return !/status code|network error|axios|force=true|sqlstate|exception|undefined|null|econn|timeout of|\bstack\b/i.test(
    msg
  );
}

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
 * Priority: fixed status-code copy > whitelisted human server message >
 * caller fallback. Never returns a raw Axios/Error message or an internal
 * backend flag.
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

  // Known status → fixed friendly copy (never trust the body here).
  if (STATUS_COPY[status]) return STATUS_COPY[status];

  // Unknown status: only surface the server message if it reads like human copy.
  if (looksHuman(body?.message)) return body!.message!;
  return fallback;
}
