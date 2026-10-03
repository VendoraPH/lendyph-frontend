// The `deductions` a loan application states (POST /loans, PUT /loans/{id}),
// and the form fields a saved application's deductions reload into.
//
// `LoanService::createLoan()` adds the product's Processing, Service and
// Notarial fee percentages itself, but only when the request states no
// deductions. The form used to state none, so the fee rates the operator edited
// and every "other deduction" were dropped without a word. It now always states
// the list, and so carries the notarial fee the server would have added: a
// stated list switches the auto-add off.

import {
  buildLoanDeductions,
  NOTARIAL_FEE_LABEL,
  PROCESSING_FEE_LABEL,
  SERVICE_FEE_LABEL,
  type LoanDeduction,
  type OtherDeductionInput,
} from "@/lib/loan-restructure";
import { decimalInputValue } from "@/lib/percent";
import type { LoanDeduction as StoredDeduction } from "@/types/loan";

/** The product fee columns the server charges when a loan states no deductions. */
export interface ProductFees {
  processing_fee?: unknown;
  service_fee?: unknown;
  notarial_fee?: unknown;
}

/** The application form's deduction fields. */
export interface DeductionFields {
  processingFeeRate: string;
  serviceFeeRate: string;
  otherDeductions: OtherDeductionInput[];
  /** Shown read-only and sent unchanged; see `buildLoanDeductions`. */
  carried: LoanDeduction[];
}

function toRate(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A product's fees as a new application's starting fields: the columns the
 * server charges from when it adds them itself, so an application left as it
 * starts saves exactly the figures it always did.
 */
export function productDeductionFields(product: ProductFees): DeductionFields {
  const notarial = toRate(product.notarial_fee);
  return {
    processingFeeRate: decimalInputValue(product.processing_fee),
    serviceFeeRate: decimalInputValue(product.service_fee),
    otherDeductions: [],
    carried: notarial > 0 ? [{ name: NOTARIAL_FEE_LABEL, amount: notarial, type: "percentage" }] : [],
  };
}

/**
 * A saved application's deductions as the form's fields, or null when it has
 * none stored, and the caller starts from the product instead.
 *
 * A percentage item keeps its rate in `original_value` (its `amount` is the
 * pesos that rate came to); a fixed item keeps its pesos in both. The first
 * Processing and Service Fee percentages fill the two rate fields, and when
 * one is missing it is 0%, never the product's current rate. Any other
 * percentage item, the notarial fee, has no field and is carried unchanged.
 * Fixed items become other deductions.
 */
export function storedDeductionFields(
  items: readonly StoredDeduction[] | null | undefined,
): DeductionFields | null {
  if (!items || items.length === 0) return null;

  const fields: DeductionFields = {
    processingFeeRate: "0",
    serviceFeeRate: "0",
    otherDeductions: [],
    carried: [],
  };
  let hasProcessing = false;
  let hasService = false;

  for (const item of items) {
    const value = toRate(item.original_value ?? item.amount);
    if (item.type === "percentage" && item.name === PROCESSING_FEE_LABEL && !hasProcessing) {
      hasProcessing = true;
      fields.processingFeeRate = decimalInputValue(value);
    } else if (item.type === "percentage" && item.name === SERVICE_FEE_LABEL && !hasService) {
      hasService = true;
      fields.serviceFeeRate = decimalInputValue(value);
    } else if (item.type === "percentage") {
      fields.carried.push({ name: item.name, amount: value, type: "percentage" });
    } else {
      fields.otherDeductions.push({ name: item.name, amount: decimalInputValue(value) });
    }
  }
  return fields;
}

/** The rate a fee field stands for: what it says, or the product's while it is blank. */
export function feePercent(field: string, productRate: unknown): number {
  return field.trim() === "" ? toRate(productRate) : parseFloat(field) || 0;
}

/**
 * The `deductions` an application sends: exactly the fees and deductions the
 * form shows, so a waived fee is simply absent. `POST /loans` charges the
 * product's own fees only when no list is sent at all; a sent empty list is
 * "none".
 */
export function applicationDeductions({
  processingFeePercent,
  serviceFeePercent,
  otherDeductions,
  carried,
}: {
  processingFeePercent: number;
  serviceFeePercent: number;
  otherDeductions: OtherDeductionInput[];
  carried: LoanDeduction[];
}): LoanDeduction[] {
  return buildLoanDeductions({
    processingFeePercent,
    serviceFeePercent,
    otherDeductions,
    carried,
  });
}
