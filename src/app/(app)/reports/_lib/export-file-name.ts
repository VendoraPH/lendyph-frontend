import type { DateRange } from "./types";

/**
 * The name of a server-written CSV. A report over a period names its dates
 * (`releases_list-2026-11-01-2026-11-10.csv`); a report as of one day names
 * that day only (`savings_balances-2026-11-10.csv`), since it covers no range.
 */
export function csvFileName(
  reportId: string,
  report: { noDateRange?: boolean },
  range: DateRange,
  asOf: string,
): string {
  return report.noDateRange ? `${reportId}-${asOf}.csv` : `${reportId}-${range.from}-${range.to}.csv`;
}
