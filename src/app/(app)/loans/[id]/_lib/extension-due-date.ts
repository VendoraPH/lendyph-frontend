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

/** The calendar parts of a `YYYY-MM-DD` date, month zero-based; null if unreadable. */
function readDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

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
 * A month is the month after `date`'s month, on the loan's anchor day (its
 * start date's day of the month), or on that month's last day when it is too
 * short: a Jan 31 loan due Feb 28 steps to Mar 31, then Apr 30. `date`'s own
 * day does not matter, so a date already capped by a short month does not
 * pull later dates back. The day-stepped frequencies add their fixed days.
 * Working in UTC on the calendar date keeps the browser's time zone out of it.
 * Null for a date it cannot read or a frequency the server has no step for.
 */
export function stepNextPeriod(date: string, frequency: string, anchorDay: number): string | null {
  const parts = readDate(date);
  if (!parts) return null;
  const { year, month, day } = parts;
  if (frequency === "monthly" || frequency === "upon_maturity") {
    const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
    return isoDate(Date.UTC(year, month + 1, Math.min(anchorDay, lastDay)));
  }
  const days = STEP_DAYS[frequency];
  return days === undefined ? null : isoDate(Date.UTC(year, month, day + days));
}

/**
 * The maturity date an extension will store: one period, by the loan's
 * frequency, after the latest due date among its open instalments, anchored
 * to `startDate`'s day of the month. That is what
 * `LoanAdjustmentService::extendLoan()` steps from, not `loans.maturity_date`,
 * though the two agree on an ordinary loan.
 *
 * Null when no instalment is open, which the server refuses to extend, or
 * when the start date cannot be read.
 */
export function extensionDueDate(
  rows: readonly Pick<ApiScheduleRow, "due_date" | "status">[],
  frequency: string,
  startDate: string | null | undefined,
): string | null {
  const start = readDate(startDate ?? "");
  const latest = rows
    .filter((row) => OPEN_STATUSES.has(row.status))
    .map((row) => String(row.due_date).slice(0, 10))
    .reduce<string | null>((max, due) => (max === null || due > max ? due : max), null);
  return latest === null || start === null ? null : stepNextPeriod(latest, frequency, start.day);
}
