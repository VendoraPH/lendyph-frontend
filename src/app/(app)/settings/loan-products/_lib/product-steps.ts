/**
 * The loan product dialog's steps (Arvin, 2026-11-17: long forms become
 * steps). One step per section of the form, with Amount & Term inside Basic
 * Info and the grace period inside Fees & Penalties, where it already sat.
 *
 * Each step lists the form's own keys and the keys the save sends (and a 422
 * can name), so a refusal opens the step holding the field.
 */

import { hasStepErrors, stepErrorsOf, type FormStepDef, type StepErrors } from "@/lib/form-stepper";
import { defaultTermError, type ProductForm } from "./product-form";

export const PRODUCT_STEPS: readonly FormStepDef[] = [
  {
    id: "basic",
    title: "Basic Info",
    fields: ["name", "description", "min_amount", "max_amount", "min_term", "max_term", "term", "term_unit"],
  },
  {
    id: "interest",
    title: "Interest",
    fields: [
      "min_interest_rate",
      "max_interest_rate",
      "interest_rate",
      "interest_rate_frequency",
      "interest_method",
      "frequencies",
      "frequency",
    ],
  },
  {
    id: "fees",
    title: "Fees & Penalties",
    fields: [
      "processing_fee",
      "min_processing_fee",
      "max_processing_fee",
      "service_fee",
      "min_service_fee",
      "max_service_fee",
      "notarial_fee",
      "penalty_rate",
      "grace_period_enabled",
      "grace_period_days",
      "custom_fees",
    ],
  },
  { id: "scb", title: "Share Capital Build-Up", fields: ["scb_required", "min_scb", "max_scb"] },
];

/** A step's errors, and the toast that shows them (null: the browser shows them). */
export interface ProductStepCheck {
  errors: StepErrors;
  toast: string | null;
}

/**
 * The form's own checks for one step, in the order the save ran them: first
 * the browser's checks of the step's inputs (`required`, `min`, `max`),
 * given as the invalid inputs' names and messages, then the Default Term
 * range, which the save showed as a toast.
 */
export function productStepCheck(
  stepId: string,
  form: ProductForm,
  invalidInputs: StepErrors,
): ProductStepCheck {
  const step = PRODUCT_STEPS.find((s) => s.id === stepId);
  if (!step) return { errors: {}, toast: null };
  const native = stepErrorsOf(invalidInputs, step);
  if (hasStepErrors(native)) return { errors: native, toast: null };
  const termError = stepId === "basic" ? defaultTermError(form) : null;
  return termError ? { errors: { term: termError }, toast: termError } : { errors: {}, toast: null };
}
