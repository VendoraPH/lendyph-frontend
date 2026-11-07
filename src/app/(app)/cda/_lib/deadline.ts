/**
 * CDA deadline arithmetic, on plain `YYYY-MM-DD` strings.
 *
 * Dates are treated as calendar days with no time of day, so the math runs in
 * UTC on purpose: a Manila-local `Date` would shift a day either side of
 * midnight. "Today" comes from `todayISO()` (Asia/Manila) at the call site.
 *
 * The 120 days are CDA's default, never a constant in a screen: the server
 * sends each period's deadline and the settings carry `deadline_days`.
 */

export const DEFAULT_DEADLINE_DAYS = 120;
/** Days before a deadline that staff are reminded, before "due" and "overdue". */
export const DEFAULT_REMINDER_DAYS = [30, 15, 7, 3];

const DAY_MS = 86_400_000;

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Fiscal year-end plus `days` calendar days. */
export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * DAY_MS);
}

/** Dec 31 2025 + 120 days = Apr 30 2026 (2026 is not a leap year). */
export function computeDefaultDeadline(fiscalYearEnd: string, days = DEFAULT_DEADLINE_DAYS): string {
  return addDays(fiscalYearEnd, days);
}

/** The last day of the fiscal year that ends in `endMonth` (1–12) of `year`. */
export function fiscalYearEnd(year: number, endMonth = 12): string {
  // Day 0 of the next month is the last day of this one.
  return fromUtcMs(Date.UTC(year, endMonth, 0));
}

/** An extension, when CDA granted one, replaces the default deadline. */
export function effectiveDeadline(period: {
  default_deadline: string;
  extended_deadline: string | null;
}): string {
  return period.extended_deadline || period.default_deadline;
}

/** Whole days from `today` to `deadline`; negative once it has passed. */
export function daysUntil(deadline: string, today: string): number {
  return Math.round((toUtcMs(deadline) - toUtcMs(today)) / DAY_MS);
}

export type DeadlineState = "done" | "upcoming" | "due_soon" | "due_today" | "overdue";

/**
 * Where a report stands against its deadline. `done` wins over everything: a
 * report already filed is not overdue just because the date has passed.
 * "Due soon" is the last `soonDays` days (the 7-day reminder by default).
 */
export function deadlineState(days: number, done: boolean, soonDays = 7): DeadlineState {
  if (done) return "done";
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= soonDays) return "due_soon";
  return "upcoming";
}

/**
 * The reminder milestone that is due on `days` remaining, if any: one of the
 * configured offsets, "due" on the day, "overdue" after it.
 */
export function reminderMilestone(
  days: number,
  reminderDays: number[] = DEFAULT_REMINDER_DAYS,
): number | "due" | "overdue" | null {
  if (days < 0) return "overdue";
  if (days === 0) return "due";
  return reminderDays.includes(days) ? days : null;
}

/** Reports are filed the year AFTER the fiscal year they cover. */
export function defaultReportingYear(today: string): number {
  return Number(today.slice(0, 4)) - 1;
}

export function describeDaysLeft(days: number): string {
  if (days === 0) return "Due today";
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  return `${days} day${days === 1 ? "" : "s"} left`;
}
