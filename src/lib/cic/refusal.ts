// What a CIC refusal carries beside its message: the server's refusal code and,
// for a file the server won't generate or encrypt, its validation counts. A
// rate-limited answer (429) is put in words here too, so every CIC screen,
// toast or page, reads the same sentence. Other messages show through
// `getErrorMessage`, in the server's words.
import type { CicValidationSummary } from "@/types/cic";

export interface CicRefusal {
  code: string | null;
  validation: CicValidationSummary | null;
}

interface HttpErrorLike {
  response?: { status?: number; data?: unknown; headers?: Record<string, unknown> };
}

function isValidation(v: unknown): v is CicValidationSummary {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.errors === "number" && typeof o.warnings === "number" && Array.isArray(o.top_issues);
}

function responseOf(err: unknown): HttpErrorLike["response"] | undefined {
  return err && typeof err === "object" ? (err as HttpErrorLike).response : undefined;
}

export function cicRefusal(err: unknown): CicRefusal {
  const body = responseOf(err)?.data;
  if (!body || typeof body !== "object") return { code: null, validation: null };
  const { code, data } = body as { code?: unknown; data?: { validation?: unknown } | null };
  return {
    code: typeof code === "string" ? code : null,
    validation: isValidation(data?.validation) ? data.validation : null,
  };
}

/** Laravel's own throttle text, which reads as a heading, not a sentence for staff. */
const LARAVEL_THROTTLE = /^too many attempts\.?$/i;

export const CIC_RATE_LIMIT_WORDS = "Too many CIC requests. Wait a minute and try again.";

function secondsOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

/**
 * A 429's words: the server's own message unless it is Laravel's default,
 * else how long to wait (`retry_after` in the body, or the Retry-After
 * header), else a minute. Null for any other answer.
 */
export function cicRateLimitMessage(err: unknown): string | null {
  const response = responseOf(err);
  if (response?.status !== 429) return null;
  const body = response.data && typeof response.data === "object" ? (response.data as Record<string, unknown>) : {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message !== "" && !LARAVEL_THROTTLE.test(message)) return message;
  const seconds = secondsOf(body.retry_after) ?? secondsOf(response.headers?.["retry-after"]);
  if (seconds === null) return CIC_RATE_LIMIT_WORDS;
  if (seconds <= 60) return `Too many CIC requests. Wait ${seconds} ${seconds === 1 ? "second" : "seconds"} and try again.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many CIC requests. Wait ${minutes} minutes and try again.`;
}

/** Puts a 429's words into its body's `message`, where every error reader looks. Returns the same error. */
export function withCicRateLimitWords(err: unknown): unknown {
  const message = cicRateLimitMessage(err);
  const response = responseOf(err);
  if (message === null || !response) return err;
  const body = response.data && typeof response.data === "object" ? response.data : {};
  response.data = { ...body, message };
  return err;
}
