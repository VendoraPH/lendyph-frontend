/**
 * The import's "Balances as of" date (finish run round 6), sent as the run's
 * `as_of_date`. Imported loans refuse payments dated on or before it (the
 * loan's `imported_arrears_baseline`), so the usual cut-over is: export at
 * the end of day D, import with balances as of D, collect from D + 1.
 *
 * Held to the server's own rule (`StoreCsvImportRunRequest`:
 * `date_format:Y-m-d`, `after:1999-12-31`, `before_or_equal:today`) so the
 * step says so before the run is opened; the server still decides, and its
 * refusal is shown on the field (`balancesAsOfRefusal`).
 */

import { validationErrors } from "@/lib/api-error";

/** The earliest date the server accepts (`after:1999-12-31`). */
export const BALANCES_AS_OF_EARLIEST = "2000-01-01";

export const BALANCES_AS_OF_HINT =
  "The date the file's balances were taken, usually the last day before you go live. Imported loans refuse payments dated on or before it.";

/** A real calendar date written `YYYY-MM-DD`. */
function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Why the date can't be sent, in words, or null when it can. `today` is
 * today in Manila, `YYYY-MM-DD`; both compare as strings.
 */
export function balancesAsOfProblem(value: string, today: string): string | null {
  const date = value.trim();
  if (date === "") return "Enter the date the file's balances were taken.";
  if (!isCalendarDate(date)) return "Enter a date such as 2026-11-25.";
  if (date > today) return "Balances as of can't be after today: the file's balances were taken on or before today.";
  if (date < BALANCES_AS_OF_EARLIEST) return "Balances as of can't be before Jan 1, 2000.";
  return null;
}

/** The server's refusal of `as_of_date` on a 422, in its words, or null. */
export function balancesAsOfRefusal(err: unknown): string | null {
  return validationErrors(err)?.as_of_date?.[0] ?? null;
}
