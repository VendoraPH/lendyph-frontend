// A step action (approve, send back, re-submit) answered 409: the step the
// button named isn't waiting any more, because someone else acted first or the
// loan moved on. The server's sentence names the step the loan is now at, so
// the page reloads the loan and its chain and shows that sentence as it is.

import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

export function stepConflictMessage(err: unknown): string | null {
  if (httpStatusOf(err) !== 409) return null;
  return getErrorMessage(err);
}
