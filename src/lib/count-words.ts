import { formatCount, formatCountOf } from "@/lib/report-format";

/**
 * Counts in words, each noun in the right number ("1 warning", never
 * "1 warnings"): the shared pager, and the import's counts.
 */

/**
 * The shared pager's line: "Showing 1 to 10 of 25 results", "Showing 1 of 1
 * result", or "No results". `first` and `last` are 1-based rows of this page.
 */
export function pagerSummary(first: number, last: number, total: number): string {
  if (total <= 0) return "No results";
  const range = first === last ? formatCount(first) : `${formatCount(first)} to ${formatCount(last)}`;
  return `Showing ${range} of ${formatCountOf(total, "result")}`;
}

/** The upload's progress: "1 of 1 piece accepted". */
export function piecesAccepted(accepted: number, total: number): string {
  return `${formatCount(accepted)} of ${formatCountOf(total, "piece")} accepted`;
}

/** A resumed upload: "3 of 4 pieces of members.csv are already on the server." */
export function piecesOnServer(received: number, total: number, name: string): string {
  return `${formatCount(received)} of ${formatCountOf(total, "piece")} of ${name} ${received === 1 ? "is" : "are"} already on the server.`;
}

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
