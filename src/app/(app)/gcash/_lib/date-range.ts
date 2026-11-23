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
