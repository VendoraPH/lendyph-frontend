/**
 * The New Loan Application form (and `?edit=`) as steps for `FormStepper`
 * (Arvin, 2026-11-17: long forms become numbered steps). Layout only: the
 * fields, labels, checks and payload are the form's own; this file says which
 * step holds each one. Dependency-free, so it runs under `tsx --test`.
 *
 * Field keys are the payload's (and so a 422's) keys. The page gives each
 * field a `name`, `id` or `data-field` equal to its key, so an error focuses it.
 */

import { errorMessages, type FormStepDef, type StepCheckTrigger, type StepErrors } from "@/lib/form-stepper";

/**
 * Every key the form sends on `POST /loans` or `PUT /loans/{id}`. Typed by
 * hand: keep it in step with the page's payload and `saveLoanEdit`
 * (`collaterals`).
 */
export const LOAN_FORM_SENT_FIELDS = [
  "borrower_id",
  "co_maker_ids",
  "account_officer_id",
  "purpose",
  "policy_exception",
  "policy_exception_details",
  "loan_product_id",
  "principal_amount",
  "term",
  "frequency",
  "interest_rate",
  "scb_amount",
  "remarks",
  "collaterals",
  "start_date",
  "deductions",
] as const;

/**
 * The steps. The Collaterals step shows only for a role that can view
 * collaterals, as the card did; without it the form never states them. A
 * restructure edit's deductions card is titled "Deductions", as before.
 */
export function loanFormSteps({
  showCollaterals,
  isRestructureEdit,
}: {
  showCollaterals: boolean;
  isRestructureEdit: boolean;
}): FormStepDef[] {
  const steps: FormStepDef[] = [
    {
      id: "member",
      title: "Member & Co-Maker",
      fields: [
        "borrower_id",
        "co_maker_ids",
        "account_officer_id",
        "purpose",
        "policy_exception",
        "policy_exception_details",
      ],
    },
    {
      id: "terms",
      title: "Loan Product & Terms",
      fields: ["loan_product_id", "principal_amount", "term", "frequency", "interest_rate", "scb_amount", "remarks"],
    },
  ];
  if (showCollaterals) steps.push({ id: "collaterals", title: "Collaterals", fields: ["collaterals"] });
  steps.push(
    {
      id: "deductions",
      title: isRestructureEdit ? "Deductions" : "Deductions & Net Proceeds",
      fields: ["start_date", "deductions"],
    },
    { id: "review", title: "Amortization Schedule Preview", fields: [] },
  );
  return steps;
}

/** What the form's submit check reads, already worked out by the page. */
export interface LoanFormCheck {
  hasMember: boolean;
  hasProduct: boolean;
  /** Above zero and inside the product's range. */
  principalOk: boolean;
  /** Above zero and inside the product's range. */
  termOk: boolean;
  hasFrequency: boolean;
  rateOk: boolean;
  hasReleaseDate: boolean;
  scbInvalid: boolean;
  processingFeeInvalid: boolean;
  serviceFeeInvalid: boolean;
  /** A restructure edit whose remarks the server asked for and are blank. */
  remarksMissing: boolean;
}

/**
 * The form's submit check, keyed by field: Next lists the open step's labels,
 * and Save lists them all, in this order, in one "Please complete" message.
 */
export function loanFormMissing(c: LoanFormCheck): Record<string, string> {
  const missing: Record<string, string> = {};
  if (!c.hasMember) missing.borrower_id = "Member";
  if (!c.hasProduct) missing.loan_product_id = "Loan product";
  if (!c.principalOk) missing.principal_amount = "Loan amount";
  if (!c.termOk) missing.term = "Term";
  if (!c.hasFrequency) missing.frequency = "Payment frequency";
  if (!c.rateOk) missing.interest_rate = "Interest rate";
  if (!c.hasReleaseDate) missing.start_date = "Release date";
  if (c.scbInvalid) missing.scb_amount = "Share Capital Build-Up";
  if (c.processingFeeInvalid) missing["deductions.processing_fee"] = "Processing fee";
  if (c.serviceFeeInvalid) missing["deductions.service_fee"] = "Service fee";
  if (c.remarksMissing) missing.remarks = "Remarks";
  return missing;
}

/**
 * The "Please complete" list for a step that failed its check. On Save the
 * stepper checks every step and stops at the first that fails; the loan forms
 * then list every missing field at once (`missing`, in the submit check's
 * order), as they did before they had steps. On Next only the open step's.
 * Shared with the restructure form.
 */
export function invalidStepMessages(
  trigger: StepCheckTrigger,
  stepErrors: StepErrors,
  missing: Record<string, string>,
): string[] {
  return trigger === "save" ? Object.values(missing) : errorMessages(stepErrors);
}

/** A 422's field errors (`errors`), for `showErrors`; empty for any other answer. */
export function serverFieldErrors(err: unknown): Record<string, string[]> {
  const response = (err as { response?: { status?: number; data?: { errors?: unknown } } } | null)?.response;
  const errors = response?.status === 422 ? response.data?.errors : null;
  if (!errors || typeof errors !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) out[key] = value.filter((m): m is string => typeof m === "string");
  }
  return out;
}
