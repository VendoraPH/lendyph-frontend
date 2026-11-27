import { getErrorMessage, httpStatusOf } from "@/lib/api-error";

/**
 * The server's reason when it refuses a payment preview with a 422 (for
 * example a payment dated before the loan's release date), or null when the
 * preview failed for any other reason. A refusal is what posting the same
 * amount and date would answer, so the dialog shows it and holds Record
 * Payment until the amount or date changes.
 */
export function previewRefusalMessage(err: unknown): string | null {
  return httpStatusOf(err) === 422 ? getErrorMessage(err) : null;
}

/** What a failed Record Payment says: the server's reason when it gave one. */
export function recordPaymentErrorMessage(err: unknown): string {
  return getErrorMessage(err, "We couldn't record the payment. Please try again.");
}
