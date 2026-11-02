/**
 * Insurance premium left unpaid at release.
 *
 * A release can collect only part of the premium. On every loan that owes
 * the rest, it is owed on the loan: interest-free, never added to principal,
 * and collected first from each payment, before penalty, interest and
 * principal. The server sends every figure:
 * - `insurance_owed` on the loan: the premium still owed;
 * - `allocated_to_insurance` (alias `total_insurance`) on a payment preview:
 *   what this payment will collect of it;
 * - `insurance_applied` on a repayment: what that payment collected.
 *
 * These helpers only read those figures and say whether a screen has a line
 * to show (above zero); none is worked out here.
 */
import { formatCurrency } from "@/lib/format";
import { DASH, toNumber } from "@/lib/report-format";

export const INSURANCE_PREMIUM_LABEL = "Insurance premium";
export const INSURANCE_OWED_LABEL = "Insurance premium owed — interest-free, collected first";

/** A server figure above zero, or null when there is no line to show. */
function positive(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n > 0 ? n : null;
}

/** The premium still owed on the loan, or null when none is. */
export function loanInsuranceOwed(
  loan: { insurance_owed?: number | string | null } | null | undefined
): number | null {
  return positive(loan?.insurance_owed);
}

/** What a previewed payment will collect of the insurance owed, or null. */
export function previewInsuranceApplied(
  preview: { allocated_to_insurance?: unknown; total_insurance?: unknown } | null | undefined
): number | null {
  return positive(preview?.allocated_to_insurance ?? preview?.total_insurance);
}

/** What a posted payment collected of the insurance owed, or null. */
export function repaymentInsuranceApplied(
  repayment: { insurance_applied?: unknown } | null | undefined
): number | null {
  return positive(repayment?.insurance_applied);
}

/**
 * A table's "Insurance premium owed" line: the server's figure when above
 * zero, no line (null) when none is owed, a dash when the server sent none.
 */
export function insuranceOwedLine(value: unknown): string | null {
  const n = typeof value === "number" || typeof value === "string" ? toNumber(value) : null;
  if (n === null) return DASH;
  return n > 0 ? formatCurrency(n) : null;
}
