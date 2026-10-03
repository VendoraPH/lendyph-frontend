// Rate and fee percentages: typed and prefilled exactly. What a percentage
// comes to in pesos is always the server's figure.
//
// Rates and fees may carry decimals, and a value is never rounded on display or
// on save. The API stores loan and product rates and fees as `decimal(8,4)`,
// the insurance premium percentage as `decimal(5,2)` and peso figures to the
// centavo, so a field refuses only the places its column cannot hold. The forms
// used to round every prefill to a whole number: a 1.5% product was offered at
// 2%, and the loan was saved at 2% or refused as outside the product's own range.

import { formatRate } from "@/lib/format";

/** Decimal places of a `decimal(8,4)` rate or fee percentage. */
export const RATE_DECIMALS = 4;

/** Decimal places of `loans.insurance_premium_pct`, a `decimal(5,2)`. */
export const INSURANCE_PCT_DECIMALS = 2;

/** Decimal places of a peso amount: centavos. */
export const PESO_DECIMALS = 2;

/**
 * What a rate or amount field keeps of a keystroke or a paste: digits and one
 * decimal point, with at most `decimals` places after it. A place beyond the
 * column's scale is refused, not rounded, so the field never shows a value the
 * server would store differently. A trailing point survives ("1.") so the next
 * digit can follow it.
 */
export function sanitizeDecimalInput(raw: string, decimals: number = RATE_DECIMALS): string {
  const [whole, ...rest] = raw.replace(/[^\d.]/g, "").split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, decimals)}`;
}

/**
 * A stored rate or amount as a field's starting text: "" when there is none,
 * otherwise the exact value without the API's padding ("1.5000" becomes "1.5",
 * "5.0000" becomes "5").
 */
export function decimalInputValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? formatRate(n) : "";
}
