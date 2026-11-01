/**
 * The loan product form's shape and the body it is saved as. Kept out of the
 * page so the payload can be unit-tested in a plain node process.
 */

export interface CustomFeeEntry {
  name: string;
  type: "fixed" | "percentage";
  value: string;
  term_days_gt: string;
  term_days_lt: string;
  term_days_eq: string;
  loan_amount_gt: string;
  loan_amount_lt: string;
  loan_amount_eq: string;
}

export const EMPTY_FEE: CustomFeeEntry = {
  name: "",
  type: "fixed",
  value: "",
  term_days_gt: "",
  term_days_lt: "",
  term_days_eq: "",
  loan_amount_gt: "",
  loan_amount_lt: "",
  loan_amount_eq: "",
};

export interface ProductForm {
  name: string;
  description: string;
  min_amount: string;
  max_amount: string;
  min_term: string;
  max_term: string;
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
  custom_fees: CustomFeeEntry[];
}

export const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  min_amount: "",
  max_amount: "",
  min_term: "",
  max_term: "",
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
  custom_fees: [],
};

export function formToApiPayload(form: ProductForm) {
  const custom_fees = form.custom_fees
    .filter((f) => f.name.trim() && f.value.trim())
    .map((f) => {
      const conditions: Record<string, number> = {};
      if (f.term_days_gt) conditions.term_days_gt = Number(f.term_days_gt);
      if (f.term_days_lt) conditions.term_days_lt = Number(f.term_days_lt);
      if (f.term_days_eq) conditions.term_days_eq = Number(f.term_days_eq);
      if (f.loan_amount_gt) conditions.loan_amount_gt = Number(f.loan_amount_gt);
      if (f.loan_amount_lt) conditions.loan_amount_lt = Number(f.loan_amount_lt);
      if (f.loan_amount_eq) conditions.loan_amount_eq = Number(f.loan_amount_eq);
      return {
        name: f.name,
        type: f.type,
        value: Number(f.value),
        ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
      };
    });

  return {
    name: form.name,
    min_interest_rate: Number(form.min_interest_rate),
    max_interest_rate: Number(form.max_interest_rate),
    interest_method: form.interest_method as "straight" | "diminishing" | "upon_maturity",
    interest_rate_frequency: form.interest_rate_frequency as
      | "daily"
      | "weekly"
      | "bi_weekly"
      | "semi_monthly"
      | "monthly",
    min_term: Number(form.min_term),
    max_term: Number(form.max_term),
    term_unit: form.term_unit as "months" | "days",
    frequencies: form.frequencies,
    processing_fee: form.max_processing_fee ? Number(form.max_processing_fee) : undefined,
    min_processing_fee: form.min_processing_fee ? Number(form.min_processing_fee) : undefined,
    max_processing_fee: form.max_processing_fee ? Number(form.max_processing_fee) : undefined,
    service_fee: form.max_service_fee ? Number(form.max_service_fee) : undefined,
    min_service_fee: form.min_service_fee ? Number(form.min_service_fee) : undefined,
    max_service_fee: form.max_service_fee ? Number(form.max_service_fee) : undefined,
    notarial_fee: form.notarial_fee ? Number(form.notarial_fee) : undefined,
    penalty_rate: form.penalty_rate ? Number(form.penalty_rate) : undefined,
    grace_period_days: form.grace_period_enabled && form.grace_period_days ? Number(form.grace_period_days) : 0,
    min_amount: form.min_amount ? Number(form.min_amount) : undefined,
    max_amount: form.max_amount ? Number(form.max_amount) : undefined,
    scb_required: form.scb_required,
    min_scb: form.scb_required && form.min_scb ? Number(form.min_scb) : undefined,
    max_scb: form.scb_required && form.max_scb ? Number(form.max_scb) : undefined,
    ...(custom_fees.length > 0 ? { custom_fees } : {}),
  };
}
