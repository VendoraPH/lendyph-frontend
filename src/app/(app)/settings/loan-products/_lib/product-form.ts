/**
 * The loan product form's shape and the body it is saved as. Kept out of the
 * page so the payload can be unit-tested in a plain node process. The body
 * never carries `custom_fees` (see `retiredCustomFeesNotice`).
 */

import type { RateFrequency } from "@/lib/loan-terms";
import { decimalInputValue } from "@/lib/percent";
import type { LoanProduct } from "@/types/loan";

/**
 * The read-only notice for a product that still holds stored `custom_fees`.
 * Product "Additional Fees" are retired: no code ever charged them, and Fees
 * settings (scoped by product) is the single place fees are set up. The form
 * never sends `custom_fees`, so the stored list stays as it is; this only
 * tells staff it exists. Null when there are none.
 */
export function retiredCustomFeesNotice(rawFees: unknown): string | null {
  if (!Array.isArray(rawFees) || rawFees.length === 0) return null;
  const names = rawFees.map((fee) => {
    const name = fee && typeof fee === "object" ? (fee as Record<string, unknown>).name : undefined;
    return typeof name === "string" && name.trim() ? name.trim() : "Unnamed fee";
  });
  const count = names.length;
  return `${count} retired additional ${count === 1 ? "fee" : "fees"} (${names.join(", ")}). They were never charged. Recreate any you need in Settings → Fees.`;
}

/**
 * Each product field's name, as the form labels it, without its unit. The form
 * reads its labels from here, and so does the Audit Trail for a product's
 * changes, so the two never name a field differently. Keyed by the API field.
 */
export const PRODUCT_FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "Product Name",
  description: "Description",
  min_amount: "Minimum Amount",
  max_amount: "Maximum Amount",
  min_term: "Minimum Term",
  max_term: "Maximum Term",
  term: "Default Term",
  term_unit: "Term Unit",
  min_interest_rate: "Min Interest Rate",
  max_interest_rate: "Max Interest Rate",
  interest_rate: "Interest Rate",
  interest_rate_frequency: "Interest Rate Frequency",
  interest_method: "Interest Method",
  frequencies: "Payment Frequency",
  frequency: "Default Payment Frequency",
  processing_fee: "Processing Fee",
  min_processing_fee: "Minimum Processing Fee",
  max_processing_fee: "Maximum Processing Fee",
  service_fee: "Service Fee",
  min_service_fee: "Minimum Service Fee",
  max_service_fee: "Maximum Service Fee",
  notarial_fee: "Notarial Fee",
  penalty_rate: "Penalty Rate",
  grace_period_days: "Grace Period",
  scb_required: "Share Capital Build-Up Required",
  min_scb: "Minimum Share Capital Build-Up",
  max_scb: "Maximum Share Capital Build-Up",
  custom_fees: "Additional Fees",
  is_active: "Active",
  status: "Status",
};

export interface ProductForm {
  name: string;
  description: string;
  min_amount: string;
  max_amount: string;
  min_term: string;
  max_term: string;
  /** The product's default term (`loan_products.term`), kept as stored on edit. */
  term: string;
  term_unit: string;
  frequencies: string[];
  min_interest_rate: string;
  max_interest_rate: string;
  interest_method: string;
  interest_rate_frequency: string;
  min_processing_fee: string;
  max_processing_fee: string;
  min_service_fee: string;
  max_service_fee: string;
  notarial_fee: string;
  penalty_rate: string;
  grace_period_enabled: boolean;
  grace_period_days: string;
  scb_required: boolean;
  min_scb: string;
  max_scb: string;
}

export const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  min_amount: "",
  max_amount: "",
  min_term: "",
  max_term: "",
  term: "",
  term_unit: "months",
  frequencies: ["monthly"],
  min_interest_rate: "",
  max_interest_rate: "",
  interest_method: "straight",
  interest_rate_frequency: "monthly",
  min_processing_fee: "",
  max_processing_fee: "",
  min_service_fee: "",
  max_service_fee: "",
  notarial_fee: "",
  penalty_rate: "",
  grace_period_enabled: false,
  grace_period_days: "",
  scb_required: false,
  min_scb: "",
  max_scb: "",
};

/**
 * What's wrong with the Default Term, or null when it's fine: a whole number
 * from the minimum term to the maximum term. The form has to send it, because
 * the API sets a missing `term` to `max_term`.
 */
export function defaultTermError(form: ProductForm): string | null {
  const term = Number(form.term);
  const inRange =
    form.term.trim() !== "" &&
    Number.isInteger(term) &&
    term >= Number(form.min_term) &&
    term <= Number(form.max_term);
  return inRange ? null : `Enter a Default Term between ${form.min_term} and ${form.max_term}.`;
}

export function productToForm(p: LoanProduct): ProductForm {
  // Map API response fields to form fields
  const apiProduct = p as unknown as Record<string, unknown>;
  const gracePeriod = Number(apiProduct.grace_period_days ?? p.grace_period ?? 0);

  // Parse frequencies - could be array or single value
  const rawFreq = apiProduct.frequencies ?? apiProduct.frequency ?? p.payment_frequency ?? "monthly";
  const frequencies = Array.isArray(rawFreq)
    ? (rawFreq as string[])
    : [String(rawFreq)];

  // Parse interest rate range — exact, with the API's trailing zeros stripped
  const minRateRaw = apiProduct.min_interest_rate ?? p.interest_rate;
  const maxRateRaw = apiProduct.max_interest_rate ?? p.interest_rate;
  const minRate = minRateRaw != null ? decimalInputValue(minRateRaw) : "";
  const maxRate = maxRateRaw != null ? decimalInputValue(maxRateRaw) : "";

  return {
    name: p.name,
    description: p.description ?? "",
    min_amount: String(apiProduct.min_amount ?? p.min_amount ?? ""),
    max_amount: String(apiProduct.max_amount ?? p.max_amount ?? ""),
    min_term: String(apiProduct.min_term ?? p.min_term ?? ""),
    max_term: String(apiProduct.max_term ?? p.max_term ?? ""),
    term: String(apiProduct.term ?? ""),
    term_unit: String(apiProduct.term_unit ?? "months"),
    frequencies,
    min_interest_rate: minRate,
    max_interest_rate: maxRate,
    interest_method: String(apiProduct.interest_method ?? p.interest_type ?? "straight"),
    interest_rate_frequency: String(apiProduct.interest_rate_frequency ?? "monthly"),
    // Only the stored range. Filling an empty end from `processing_fee` or
    // `service_fee` wrote those figures into it on the next save.
    min_processing_fee: decimalInputValue(apiProduct.min_processing_fee),
    max_processing_fee: decimalInputValue(apiProduct.max_processing_fee),
    min_service_fee: decimalInputValue(apiProduct.min_service_fee),
    max_service_fee: decimalInputValue(apiProduct.max_service_fee),
    notarial_fee: decimalInputValue(apiProduct.notarial_fee),
    penalty_rate: (apiProduct.penalty_rate ?? p.penalty_rate) != null ? decimalInputValue(apiProduct.penalty_rate ?? p.penalty_rate) : "",
    grace_period_enabled: gracePeriod > 0,
    grace_period_days: gracePeriod > 0 ? String(gracePeriod) : "",
    scb_required: Boolean(apiProduct.scb_required ?? p.scb_required ?? false),
    min_scb: String(apiProduct.min_scb ?? p.min_scb ?? ""),
    max_scb: String(apiProduct.max_scb ?? p.max_scb ?? ""),
  };
}

/** A min or max fee as the user left it: what they typed, or null when empty. */
function feeBound(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

/**
 * The charged `processing_fee` and `service_fee` follow the max fee when one is
 * set. With no max they aren't sent, so the stored fee stays as it is; the
 * column can't hold null.
 */
export function formToApiPayload(form: ProductForm) {
  return {
    name: form.name,
    description: form.description.trim() || null,
    min_interest_rate: Number(form.min_interest_rate),
    max_interest_rate: Number(form.max_interest_rate),
    interest_method: form.interest_method as "straight" | "diminishing" | "upon_maturity",
    interest_rate_frequency: form.interest_rate_frequency as RateFrequency,
    min_term: Number(form.min_term),
    max_term: Number(form.max_term),
    term: Number(form.term),
    term_unit: form.term_unit as "months" | "days",
    frequencies: form.frequencies,
    processing_fee: form.max_processing_fee ? Number(form.max_processing_fee) : undefined,
    min_processing_fee: feeBound(form.min_processing_fee),
    max_processing_fee: feeBound(form.max_processing_fee),
    service_fee: form.max_service_fee ? Number(form.max_service_fee) : undefined,
    min_service_fee: feeBound(form.min_service_fee),
    max_service_fee: feeBound(form.max_service_fee),
    notarial_fee: form.notarial_fee ? Number(form.notarial_fee) : undefined,
    penalty_rate: form.penalty_rate ? Number(form.penalty_rate) : undefined,
    grace_period_days: form.grace_period_enabled && form.grace_period_days ? Number(form.grace_period_days) : 0,
    min_amount: form.min_amount ? Number(form.min_amount) : undefined,
    max_amount: form.max_amount ? Number(form.max_amount) : undefined,
    scb_required: form.scb_required,
    min_scb: form.scb_required && form.min_scb ? Number(form.min_scb) : undefined,
    max_scb: form.scb_required && form.max_scb ? Number(form.max_scb) : undefined,
  };
}
