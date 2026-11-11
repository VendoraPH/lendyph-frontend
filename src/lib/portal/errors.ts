import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { NotConfirmedError } from "./server-confirm";

/**
 * A portal call's failure in words. The server's own sentence wins where the
 * shared rules trust it (422 field messages, 403, 404, 409, 429); a refusal
 * this portal knows by code reads in the portal's words.
 */
const CODE_WORDS: Readonly<Record<string, string>> = {
  feature_off: "This part of the portal is turned off by your cooperative.",
  terms_required: "Please read and accept the updated terms to continue.",
  portal_off: "The member portal is not available right now.",
};

/** A 401 with no words of its own: a signed-in page whose session ended. */
export const SESSION_ENDED_WORDS = "Your session has ended. Please sign in again.";

/**
 * The portal's 401s carry their own sentence on the sign-in steps ("The
 * member number or password is incorrect."). The framework's bare
 * "Unauthenticated." means a signed-in page lost its session.
 */
function unauthorizedWords(message: unknown): string {
  if (typeof message !== "string") return SESSION_ENDED_WORDS;
  const text = message.trim();
  if (text === "" || text.length > 300 || /^unauthenticated\.?$/i.test(text) || /[\\{}<>]|\bat\s+\//.test(text)) {
    return SESSION_ENDED_WORDS;
  }
  return text;
}

export function portalErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof NotConfirmedError) return err.message;
  const data = (err as { response?: { data?: { code?: unknown; message?: unknown } } })?.response?.data;
  const code = data?.code;
  if (typeof code === "string" && Object.hasOwn(CODE_WORDS, code)) return CODE_WORDS[code];
  const status = httpStatusOf(err);
  if (status === 401) return unauthorizedWords(data?.message);
  if (status === 404) return "We couldn't find that. It may have been removed, or it isn't yours.";
  return getErrorMessage(err, fallback);
}

/**
 * The server's 422 messages by field, with the request body's `details.`
 * prefix taken off so they land beside the matching input.
 */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const errors = (err as { response?: { status?: number; data?: { errors?: unknown } } })?.response?.data?.errors;
  if (!errors || typeof errors !== "object") return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    const first = Array.isArray(messages) ? messages.find((m) => typeof m === "string") : null;
    if (typeof first === "string") out[field.replace(/^details\./, "")] = first;
  }
  return out;
}

/**
 * A failed download's body is a Blob, so its JSON message can't be read
 * where the other errors are. This reads it back into `response.data` so
 * `portalErrorMessage` sees the server's words ("The range can be at most
 * 5 years").
 */
export async function withBlobErrorBody(err: unknown): Promise<unknown> {
  const response = (err as { response?: { data?: unknown } })?.response;
  const data = response?.data;
  if (!response || typeof Blob === "undefined" || !(data instanceof Blob)) return err;
  try {
    response.data = JSON.parse(await data.text());
  } catch {
    response.data = {};
  }
  return err;
}
