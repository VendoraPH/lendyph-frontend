import { notifyError } from "@/lib/notify";
import { cdaErrorMessage } from "./refusals";

/** A failed CDA request as a toast, in words: never a permission key (`cdaErrorMessage`). */
export function notifyCdaError(err: unknown, fallback: string): void {
  notifyError(undefined, cdaErrorMessage(err, fallback));
}
