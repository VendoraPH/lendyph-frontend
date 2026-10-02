// The Release dialog's money: the insurance it sends, and what the release
// will store once that insurance is applied to the server's preview.
// Dependency-free, so it runs under `tsx --test`.

import type { ReleaseLoanPayload } from "@/services/loan.service";
import type { LoanReleasePreview } from "@/types/loan";
import type { InsurancePremiumValue } from "../_components/insurance-premium.types";
import { percentOf, roundCentavos } from "@/lib/percent";

/**
 * The premium off the principal, and what is left of it after a partial
 * payment. The server takes the premium as sent (it checks only that it is to
 * the centavo), so it is worked out here the way the server rounds every other
 * percentage fee; the remainder is the server's own `round($premium - $partial, 2)`.
 */
export function computeInsurancePremium(
  principalAmount: number,
  value: InsurancePremiumValue,
): {
  totalPremium: number;
  upfrontDeduction: number;
  remainingBalance: number;
  partialOverflow: boolean;
} {
  const principal = Math.max(0, Number(principalAmount) || 0);
  const pct = Math.max(0, Math.min(100, Number(value.percentage) || 0));
  const totalPremium = percentOf(principal, pct);

  if (value.paymentType === "full") {
    return {
      totalPremium,
      upfrontDeduction: totalPremium,
      remainingBalance: 0,
      partialOverflow: false,
    };
  }

  const rawPartial = Math.max(0, Number(value.partialAmount) || 0);
  const partialOverflow = rawPartial > totalPremium;
  const partial = Math.min(rawPartial, totalPremium);

  return {
    totalPremium,
    upfrontDeduction: partial,
    remainingBalance: roundCentavos(totalPremium - partial),
    partialOverflow,
  };
}

/** The insurance fields of `PATCH /loans/{id}/release`, every one present. */
export type ReleaseInsurancePayload = Required<Omit<ReleaseLoanPayload, "fee_fingerprint">>;

/** The insurance the dialog sends with the release, from what was typed. */
export function releaseInsurancePayload(
  principalAmount: number,
  value: InsurancePremiumValue,
): ReleaseInsurancePayload {
  const { totalPremium, upfrontDeduction, remainingBalance } = computeInsurancePremium(
    principalAmount,
    value,
  );
  return {
    insurance_premium_percentage: Number(value.percentage) || 0,
    insurance_premium_amount: totalPremium,
    insurance_payment_type: value.paymentType,
    insurance_partial_amount: value.paymentType === "partial" ? upfrontDeduction : 0,
    insurance_remaining_balance: remainingBalance,
  };
}

/** Whole centavos, so sums of 2-decimal amounts are exact. */
function centavos(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

/** What the release will store, in pesos. */
export interface ReleaseFigures {
  /** The preview's `total_deductions`: recorded and configured fees. */
  feeDeductions: number;
  /** The premium withheld at release: all of it, or the partial amount. */
  insuranceCollected: number;
  /** `total_deductions` after release: the fees plus any premium withheld. */
  totalDeductions: number;
  /** `net_proceeds` after release: what the borrower is paid out. */
  netProceeds: number;
  /**
   * The premium withheld is more than the fees leave. The release refuses
   * this with a 422 ("Insurance collected exceeds the loan net proceeds.").
   */
  exceedsNetProceeds: boolean;
}

/**
 * The server's preview with the dialog's insurance applied, exactly as
 * `LoanService::applyInsuranceOnRelease()` applies it after the fees.
 *
 * The release charges the configured fees first; the preview is that step's
 * result. The insurance step then ignores a zero percentage, withholds the
 * whole premium when it is paid in full or only the partial amount otherwise,
 * subtracts that from `net_proceeds`, and adds it to `total_deductions` only
 * when something was withheld. Nothing is clamped: a premium larger than the
 * net is refused, and `exceedsNetProceeds` says so.
 *
 * Every figure is worked in whole centavos. Both sides are 2-decimal amounts,
 * so this is what the server's `round(…, 2)` of their sum or difference gives.
 */
export function releaseFigures(
  preview: Pick<LoanReleasePreview, "total_deductions" | "net_proceeds">,
  insurance: ReleaseInsurancePayload,
): ReleaseFigures {
  const fees = centavos(preview.total_deductions);
  const collected = !insurance.insurance_premium_percentage
    ? 0
    : insurance.insurance_payment_type === "full"
      ? centavos(insurance.insurance_premium_amount)
      : centavos(insurance.insurance_partial_amount);
  const net = centavos(preview.net_proceeds) - collected;
  return {
    feeDeductions: fees / 100,
    insuranceCollected: collected / 100,
    totalDeductions: (collected > 0 ? fees + collected : fees) / 100,
    netProceeds: net / 100,
    exceedsNetProceeds: net < 0,
  };
}
