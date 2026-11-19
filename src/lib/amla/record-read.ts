import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

/**
 * One AMLA record's read, with a refusal told apart from a failure. The AMLA
 * routes answer 404 for a record outside the caller's scope and 403 for a
 * missing key, so either reads as "not found" or "no access" in words, never
 * as the "Not connected yet" panel a 404 gets elsewhere. Any other failure is
 * thrown on, so the page's error state and its Retry still work.
 */
export type AmlaRecordRead<T> = { record: T } | { refused: "not_found" | "no_access"; message: string };

const NOT_FOUND = "This record doesn't exist, or it is outside what you can see.";
const NO_ACCESS = "You don't have access to this record.";
const CONFLICT = "Someone else changed this record first. It has been read again.";

export function amlaFound<T>(record: T): AmlaRecordRead<T> {
  return { record };
}

function serverWords(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof message === "string" && message.trim() !== "" ? getErrorMessage(err, fallback) : fallback;
}

/** For `.then(amlaFound, amlaRefused)`: a 404 or 403 becomes a refusal; anything else is thrown on. */
export function amlaRefused<T = never>(err: unknown): AmlaRecordRead<T> {
  const status = httpStatusOf(err);
  if (status === 404) return { refused: "not_found", message: NOT_FOUND };
  if (status === 403) return { refused: "no_access", message: serverWords(err, NO_ACCESS) };
  throw err;
}

/** A step the server refused with 409 (someone else moved the record on): its words, else null. */
export function amlaStepConflict(err: unknown): string | null {
  return httpStatusOf(err) === 409 ? serverWords(err, CONFLICT) : null;
}
