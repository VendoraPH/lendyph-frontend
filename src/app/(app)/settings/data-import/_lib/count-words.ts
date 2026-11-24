import { formatCount, formatCountOf } from "@/lib/report-format";

/**
 * The import's counts in words, each noun in the right number ("1 warning",
 * never "1 warnings").
 */

/** The grouped report's header badge: "1 warning", "3 errors". */
export function severityCount(count: number, severity: "error" | "warning"): string {
  return formatCountOf(count, severity);
}

/** The processing bar: "3 of 40 rows", "1 of 1 row". */
export function rowsProgress(processed: number, total: number): string {
  return `${formatCount(processed)} of ${formatCountOf(total, "row")}`;
}

/** The header card's column count: "1 column", "26 columns". */
export function columnsFound(found: number): string {
  return formatCountOf(found, "column");
}

/** Rows the server hasn't reached yet. */
export function rowsNotReached(count: number): string {
  return `${formatCountOf(count, "row")} ${count === 1 ? "has" : "have"} not been reached yet.`;
}

/** A finished run with rows that have no outcome. */
export function rowsWithoutOutcome(undecided: number, total: number): string {
  return `${formatCount(undecided)} of the ${formatCountOf(total, "row")} read ${undecided === 1 ? "has" : "have"} no recorded outcome`;
}

/** A run whose outcomes add up to more than the rows read. */
export function rowsOvercounted(decided: number, total: number): string {
  return `The outcomes total ${formatCount(decided)}, which is more than the ${formatCountOf(total, "row")} read.`;
}

/** The pre-check's rows beyond its ceiling. */
export function rowsLeftUnchecked(count: number): string {
  return `The remaining ${formatCount(count)} ${count === 1 ? "was" : "were"} not checked here`;
}

/** A product name several loan products share. */
export function productMatches(count: number): string {
  return `Matches ${formatCountOf(count, "product")} with this name:`;
}
