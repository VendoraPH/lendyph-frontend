/**
 * Posting and reversing can be refused by the server: a closed period, an
 * entry already reversed, a collision (409), or an entry that changed while it
 * was being posted (422, A0b's `edit_version` check). After a refusal the
 * journal on screen may no longer be what the server holds, so it is reloaded.
 */
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

export function isRefusal(err: unknown): boolean {
  const status = httpStatusOf(err);
  return status === 409 || status === 422;
}

/**
 * Runs a post or reverse. Resolves to null on success, or to the message to
 * show: the server's own words for a refusal, after asking for a reload.
 */
export async function runJournalAction(
  action: () => Promise<void>,
  onRefused: () => void,
  fallback: string,
): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (err) {
    if (isRefusal(err)) onRefused();
    return getErrorMessage(err, fallback);
  }
}
