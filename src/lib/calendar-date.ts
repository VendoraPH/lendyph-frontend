/**
 * A calendar date as the API takes one (finish run round 2, decision 1):
 * written year-month-day (`2026-11-24`) and naming a real day, so `2026-02-30`
 * is refused here as the server's `date_format:Y-m-d` refuses it. Two such
 * strings compare as the dates do.
 */

const YEAR_MONTH_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The year, month (1–12) and day of a calendar date, or null for anything else. */
export function calendarDateParts(value: string | null | undefined): [number, number, number] | null {
  const match = YEAR_MONTH_DAY.exec(value ?? "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? [year, month, day] : null;
}

/** Whether `value` is a calendar date written year-month-day. */
export function isCalendarDate(value: string | null | undefined): value is string {
  return calendarDateParts(value) !== null;
}
