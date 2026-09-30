// The due date a loan extension will store. Dependency-free, so it runs under
// `tsx --test`.

import type { ApiScheduleRow } from "@/lib/amortization";

/** The instalment statuses `extendLoan()` counts as open. */
const OPEN_STATUSES = new Set<string>(["pending", "partial", "overdue"]);

/** `stepNextPeriod()`'s fixed steps, in days, for the frequencies it steps by day. */
const STEP_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  bi_weekly: 14,
  semi_monthly: 15,
};

function isoDate(utcMillis: number): string {
  const date = new Date(utcMillis);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * One period after `date` (`YYYY-MM-DD`), as
 * `LoanAdjustmentService::stepNextPeriod()` steps it.
 *
 * A month is Carbon's `addMonth()`, which OVERFLOWS: the same day next month,
 * spilling into the month after when that day does not exist. Jan 31 becomes
 * Mar 3 (Mar 2 in a leap year), not Feb 28. `Date.UTC` spills the same way,
 * and working in UTC on the calendar date keeps the browser's time zone out
 * of it. Null for a date it cannot read or a frequency the server has no step
 * for.
 */
export function stepNextPeriod(date: string, frequency: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  if (frequency === "monthly" || frequency === "upon_maturity") {
    return isoDate(Date.UTC(year, month + 1, day));
  }
  const days = STEP_DAYS[frequency];
  return days === undefined ? null : isoDate(Date.UTC(year, month, day + days));
}

/**
 * The maturity date an extension will store: one period, by the loan's
 * frequency, after the latest due date among its open instalments. That is
 * what `LoanAdjustmentService::extendLoan()` steps from, not
 * `loans.maturity_date`, though the two agree on an ordinary loan.
 *
 * Null when no instalment is open, which the server refuses to extend.
 */
export function extensionDueDate(
  rows: readonly Pick<ApiScheduleRow, "due_date" | "status">[],
  frequency: string,
): string | null {
  const latest = rows
    .filter((row) => OPEN_STATUSES.has(row.status))
    .map((row) => String(row.due_date).slice(0, 10))
    .reduce<string | null>((max, due) => (max === null || due > max ? due : max), null);
  return latest === null ? null : stepNextPeriod(latest, frequency);
}
