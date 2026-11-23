import { getErrorMessage, httpStatusOf, looksHuman, validationErrors } from "@/lib/api-error";

/** An unknown link, or the server switch off: every public route answers a bare 404. */
export const NOT_AVAILABLE = "Online applications are not available. Please contact the office.";

/** `ApplicantSessions::EXPIRED`, for a 401 that came without words. */
export const SESSION_ENDED = "Your session has ended. Ask for a new code to continue.";

interface RefusalBody {
  message?: unknown;
  code?: unknown;
}

function bodyOf(err: unknown): RefusalBody | undefined {
  return (err as { response?: { data?: RefusalBody } } | null)?.response?.data;
}

/** Laravel's "The route … could not be found." isn't for an applicant either. */
const ROUTE_NOT_FOUND = /^the route /i;

/**
 * The server's own sentence, or null when it sent none. An empty 404, the
 * framework's stock words and technical text (a model binding's "No query
 * results for model […]") never reach the applicant (`looksHuman`).
 */
function serverWords(err: unknown): string | null {
  const message = bodyOf(err)?.message;
  if (typeof message !== "string") return null;
  const text = message.trim();
  return /\s/.test(text) && looksHuman(text) && !ROUTE_NOT_FOUND.test(text) ? text : null;
}

/**
 * A failed public request in words: the server's own wherever it gave them
 * (every refusal on these routes is written for the applicant), else the
 * app's usual copy. A bare 404 or 501 means online applications aren't here.
 */
export function publicErrorMessage(err: unknown, fallback: string): string {
  const status = httpStatusOf(err);
  if (status === 401) return serverWords(err) ?? SESSION_ENDED;
  if (status === 404) return serverWords(err) ?? NOT_AVAILABLE;
  if (status === 501) return NOT_AVAILABLE;
  if (status === 503) return serverWords(err) ?? getErrorMessage(err, fallback);
  return getErrorMessage(err, fallback);
}

/**
 * The session refusals the screens act on (`RequireApplicationSession`):
 * `ended` (401: no, unknown, idle or old session), `submitted` (409: this
 * session already submitted) and `closed` (409: the link stopped taking
 * applications).
 */
export type SessionProblem = "ended" | "submitted" | "closed";

export function sessionProblem(err: unknown): SessionProblem | null {
  const status = httpStatusOf(err);
  const code = bodyOf(err)?.code;
  if (status === 401) return "ended";
  if (status === 409 && code === "session_submitted") return "submitted";
  if (status === 409 && code === "link_closed") return "closed";
  return null;
}

/** A 422's fields, each with its first message, or null for any other answer. */
export function fieldErrors(err: unknown): Record<string, string> | null {
  const errors = validationErrors(err);
  if (!errors) return null;
  return Object.fromEntries(
    Object.entries(errors).flatMap(([key, messages]) => (messages[0] ? [[key, messages[0]] as const] : [])),
  );
}
