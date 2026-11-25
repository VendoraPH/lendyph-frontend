/**
 * An imported loan's as-of date (finish run, round 6): the loan's file already
 * counts its payments up to `payments_counted_until`, so the server refuses a
 * payment dated on or before it. The payment forms block those days and say
 * why; the server's refusal still shows under the date if one gets through.
 * Pure, so it runs under `tsx --test`.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day the imported file counts payments up to (`Y-m-d`), or null when the loan has none. */
export function paymentsCountedUntil(
  loan: { payments_counted_until?: string | null } | null | undefined,
): string | null {
  const value = loan?.payments_counted_until;
  return typeof value === "string" && ISO_DAY.test(value) ? value : null;
}

/** Whether a payment dated `day` (`Y-m-d`) is refused: on or before the as-of date. */
export function paymentDayBlocked(day: string, until: string | null): boolean {
  return until !== null && ISO_DAY.test(day) && day <= until;
}

/** "2026-06-30" → "Jun 30, 2026", read as a calendar day on any computer. */
function dayInWords(day: string): string {
  const match = ISO_DAY.exec(day);
  if (!match) return day;
  const [, year, month, date] = match;
  return `${MONTHS[Number(month) - 1]} ${Number(date)}, ${year}`;
}

/** The hint under the payment date, or null when the loan has no as-of date. */
export function countedUntilHint(until: string | null): string | null {
  return until === null ? null : `The imported file counts payments up to ${dayInWords(until)}`;
}

/** The first day a payment may be dated (`Y-m-d`), the day after the as-of date; null when there is none. */
export function firstPaymentDay(until: string | null): string | null {
  const match = until === null ? null : ISO_DAY.exec(until);
  if (!match) return null;
  // Calendar arithmetic on the UTC clock, read back from the same clock, so
  // the computer's own zone never moves the day.
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/**
 * The server's words on the payment date from a 422's `errors`, else null, so
 * the form shows them under the field rather than in a general message.
 */
export function paymentDateRefusal(errors: Record<string, string[]> | null | undefined): string | null {
  const messages = errors?.payment_date;
  return Array.isArray(messages) && typeof messages[0] === "string" && messages[0] !== "" ? messages[0] : null;
}
