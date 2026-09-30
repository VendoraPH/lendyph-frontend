// Payload helpers for POST /loans/{loan}/restructure, and where a restructured
// loan's balance went.
//
// The endpoint accepts the terms and deductions the user configured on the form
// rather than re-deriving them from the loan product, so these helpers keep the
// created loan matching the amortization preview the user just approved.

import { isEverReleasedLoanStatus } from "@/constants/loan-status";

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
export const NOTARIAL_FEE_LABEL = "Notarial Fee";
export const OTHER_DEDUCTION_LABEL = "Other Deduction";

/**
 * Flatten the form's fee inputs into the API's `deductions[]` shape.
 * Zero/blank rows are dropped — a 0% fee is not a deduction — and an unnamed
 * custom row falls back to a generic label so the API never gets a blank name.
 *
 * `carried` are items the form shows but has no field for (a product's
 * notarial fee), sent as they are after the two fees: the order
 * `LoanService::createLoan()` itself adds the product's fees in.
 */
export function buildLoanDeductions({
  processingFeePercent,
  serviceFeePercent,
  otherDeductions,
  carried = [],
}: {
  processingFeePercent: number;
  serviceFeePercent: number;
  otherDeductions: OtherDeductionInput[];
  carried?: LoanDeduction[];
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

  deductions.push(...carried);

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

/**
 * The loan a restructure moved this loan's balance to: the entry of its
 * `restructured_into` that was released. That list holds every restructure
 * application raised on the loan, and a rejected or voided one never took the
 * balance, so only a released child is the loan the balance went to. Null when
 * there is none.
 */
export function restructureSuccessor<T extends { status?: unknown }>(
  restructuredInto: readonly T[] | null | undefined,
): T | null {
  return (
    restructuredInto?.find(
      (child) => typeof child.status === "string" && isEverReleasedLoanStatus(child.status),
    ) ?? null
  );
}
