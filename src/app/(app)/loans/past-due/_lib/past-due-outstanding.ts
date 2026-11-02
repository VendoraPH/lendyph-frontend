import { toNumber } from "@/lib/report-format";

/** The parts of a GET /reports/due-past-due row this module reads. */
export interface PastDueOutstandingSource {
  [key: string]: unknown;
}

/**
 * A past-due row's "Outstanding": the server's `loan_total_outstanding`, the
 * loan's everything-owed figure (the same as GET /loans `total_outstanding`),
 * repeated on every period row of that loan. Null when the row doesn't carry
 * it, so the cell shows a dash. The deprecated `outstanding_balance`
 * (principal + premium) and the period's own `balance` are deliberately not
 * read.
 */
export function readRowOutstanding(raw: PastDueOutstandingSource): number | null {
  return toNumber(raw.loan_total_outstanding);
}

/**
 * One loan-level figure across that loan's period rows. Every row states the
 * same figure, so the rows are never added; a real figure wins over a missing
 * one.
 */
export function mergeLoanFigure(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** Ascending order with a missing figure below every real one, zero included. */
export function compareFigure(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
  return a - b;
}
