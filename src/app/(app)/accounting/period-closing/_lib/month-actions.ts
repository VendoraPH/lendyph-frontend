// What the month list offers on each month, beside a year-end close.
// Dependency-free apart from the error copy, so it runs under `tsx --test`.

import { getErrorMessage } from "@/lib/api-error";
import type { AccountingPeriod } from "@/types";

/** Shown instead of Reopen on a month a live year-end close closed. */
export const REOPEN_THE_YEAR = "Reopen the year to change this month";

export type MonthAction = "close" | "reopen" | "year";

/**
 * Close for an open month, Reopen for a closed one, and "year" for a month a
 * live year-end close closed: reopening that month alone would leave the
 * year's closing entries in place, so the server refuses it (422).
 * `yearEndLabels` is `periodYearEndLabels()`'s map.
 */
export function monthAction(period: AccountingPeriod, yearEndLabels: Map<number, string>): MonthAction {
  if (period.status === "open") return "close";
  return yearEndLabels.has(period.id) ? "year" : "reopen";
}

/** A refused reopen in the server's words, or the fallback when it gave none. */
export function periodReopenFailure(err: unknown): string {
  return getErrorMessage(err, "Could not reopen this period.");
}
