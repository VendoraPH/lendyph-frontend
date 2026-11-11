import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

/** A 404 on a portal staff route: another branch's record answers the same as a missing one. */
export const NOT_IN_YOUR_BRANCHES = "We couldn't find this. It may belong to a branch you can't see, or it no longer exists.";

/** A 403 with no words of the server's own. */
export const NO_PERMISSION = "You don't have permission to do that.";

/**
 * A portal staff error in words. The server is branch-scoped: a 404 means the
 * record is outside the caller's branches (or gone), a 403 a missing
 * permission or a branch filter outside theirs, and a 409 or 422 carries the
 * server's own sentence.
 */
export function portalErrorText(err: unknown, fallback: string): string {
  const status = httpStatusOf(err);
  if (status === 404) return NOT_IN_YOUR_BRANCHES;
  if (status === 403) return getErrorMessage(err, NO_PERMISSION);
  return getErrorMessage(err, fallback);
}
