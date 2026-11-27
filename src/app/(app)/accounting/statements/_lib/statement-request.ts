/**
 * What the statements screen checks before asking, and how a refusal reads.
 * Dates are `YYYY-MM-DD`, so comparing the strings compares the dates.
 */
import { getErrorMessage } from "@/lib/api-error";

/** Why a From–To range can't be sent (the server answers 422 on `to`), or null. */
export function statementRangeError(from: string, to: string): string | null {
  return to < from ? "To must be on or after From." : null;
}

/** A 422's message, in the server's words; null for any other failure. */
export function statementRefusal(error: unknown): string | null {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 422 ? getErrorMessage(error, "These figures can't be shown for this selection.") : null;
}
