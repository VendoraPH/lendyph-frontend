import { toast } from "sonner";
import { portalErrorText } from "./errors";

/** A failed portal staff action, in words: a 404 says the record is outside the caller's branches. */
export function notifyPortalError(err: unknown, fallback: string): void {
  toast.error(portalErrorText(err, fallback));
}
