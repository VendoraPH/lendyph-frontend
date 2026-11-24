/** Shown when a typed Date To falls before Date From. */
export const DATE_RANGE_REVERSED = "Date To is before Date From.";

/**
 * True when both ends are set and Date To falls before Date From
 * (`YYYY-MM-DD` strings sort as dates). GET /gcash/transactions answers such a
 * range with a 422, so the Transactions tab asks nothing and its report can't
 * be made. The pickers bound each other, so only a typed date gets here.
 */
export function dateRangeReversed(from: string, to: string): boolean {
  return Boolean(from && to && to < from);
}

const FILTER_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIRST_YEAR = 1900;

/**
 * True when a Date From or Date To can be asked for: empty (an open end), or a
 * real `YYYY-MM-DD` date with a year from 1900. While a year is being typed the
 * date input already reports a date (0002-11-24, then 0020-, then 0202-), so
 * those wait instead of each sending a list request.
 */
export function filterDateReady(value: string): boolean {
  if (value === "") return true;
  const match = FILTER_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  if (y < FIRST_YEAR) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** True when both ends of the range are ready (see `filterDateReady`). */
export function dateRangeReady(from: string, to: string): boolean {
  return filterDateReady(from) && filterDateReady(to);
}
