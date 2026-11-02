import { toNumber } from "@/lib/report-format";

/** The parts of a GET /reports/due-past-due row this module reads. */
export interface PastDueOutstandingSource {
  [key: string]: unknown;
  loan?: { [key: string]: unknown } | null;
}

/**
 * A past-due row's "Outstanding": the server's `total_outstanding` (everything
 * owed), from the row or its loan. Null when neither carries it, so the cell
 * shows a dash. The deprecated `outstanding_balance` (principal + premium) and
 * the period's own `balance` are deliberately not read.
 */
export function readRowOutstanding(raw: PastDueOutstandingSource): number | null {
  return toNumber(raw.total_outstanding ?? raw.loan?.total_outstanding);
}

/**
 * One loan's figure across its period rows. Every row states the same loan
 * total, so the rows are never added; the first real figure wins.
 */
export function mergeOutstanding(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** Ascending order with a missing figure below every real one, zero included. */
export function compareOutstanding(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
  return a - b;
}
