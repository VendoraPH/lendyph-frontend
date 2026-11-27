import { notifyError } from "@/lib/notify";
import { portalErrorMessage } from "./errors";

/**
 * A portal failure as a toast, in the words `portalErrorMessage` chose. The
 * shared `notifyError` would re-read the error and put the staff app's 401
 * wording ("Your session has expired") over the server's own sentence, so it
 * gets the finished message only: with nothing to read, it shows its fallback.
 */
export function notifyPortalError(err: unknown, failure: string): void {
  notifyError(null, portalErrorMessage(err, failure));
}
