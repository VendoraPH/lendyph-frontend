// Payload helpers for POST /loans/{loan}/restructure.
//
// The endpoint accepts the terms and deductions the user configured on the form
// rather than re-deriving them from the loan product, so these helpers keep the
// created loan matching the amortization preview the user just approved.

export type LoanDeductionType = "fixed" | "percentage";

export interface LoanDeduction {
  name: string;
  /** Percent of principal when `type` is "percentage"; peso amount when "fixed". */
  amount: number;
  type: LoanDeductionType;
}

/** A free-form deduction row as held by the form (amounts are raw input strings). */
export interface OtherDeductionInput {
  name: string;
  amount: string;
}

export const PROCESSING_FEE_LABEL = "Processing Fee";
export const SERVICE_FEE_LABEL = "Service Fee";
export const OTHER_DEDUCTION_LABEL = "Other Deduction";

/**
 * Flatten the form's fee inputs into the API's `deductions[]` shape.
 * Zero/blank rows are dropped — a 0% fee is not a deduction — and an unnamed
 * custom row falls back to a generic label so the API never gets a blank name.
 */
export function buildLoanDeductions({
  processingFeePercent,
  serviceFeePercent,
  otherDeductions,
}: {
  processingFeePercent: number;
  serviceFeePercent: number;
  otherDeductions: OtherDeductionInput[];
}): LoanDeduction[] {
  const deductions: LoanDeduction[] = [];

  if (processingFeePercent > 0) {
    deductions.push({
      name: PROCESSING_FEE_LABEL,
      amount: processingFeePercent,
      type: "percentage",
    });
  }

  if (serviceFeePercent > 0) {
    deductions.push({
      name: SERVICE_FEE_LABEL,
      amount: serviceFeePercent,
      type: "percentage",
    });
  }

  for (const row of otherDeductions) {
    const amount = parseFloat(row.amount) || 0;
    if (amount <= 0) continue;
    deductions.push({
      name: row.name.trim() || OTHER_DEDUCTION_LABEL,
      amount,
      type: "fixed",
    });
  }

  return deductions;
}

/**
 * How far a restructure's new principal falls short of the source loan's
 * outstanding balance. A shortfall writes debt off, so the API rejects it (422)
 * unless `remarks` explain why — 0 means no explanation is required.
 *
 * The comparison is deliberately exact (no rounding) so the form demands
 * remarks in precisely the cases the API would reject.
 */
export function calcRestructureShortfall(
  principal: number,
  outstandingBalance: number | null,
): number {
  if (outstandingBalance == null || principal <= 0) return 0;
  const shortfall = outstandingBalance - principal;
  return shortfall > 0 ? shortfall : 0;
}
