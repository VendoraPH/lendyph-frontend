/**
 * The fee dialog's steps (Arvin, 2026-11-17: long forms become steps):
 * Details, Amount (fixed, percentage, the rate recipe or a written formula,
 * with its check on a sample loan) and Products (which products, and the
 * conditions).
 *
 * Each step is checked by the save's own `buildFeePayload`, with the other
 * steps' fields set to values that always pass, so a step reports exactly the
 * save's message about its own fields and nothing about the others.
 */

import { buildFeePayload, buildFormulaFields, EMPTY_FORMULA_FIELDS } from "@/lib/fee-form";
import type { FormStepDef, StepErrors } from "@/lib/form-stepper";

export const FEE_STEPS: readonly FormStepDef[] = [
  { id: "details", title: "Details", fields: ["name", "type"] },
  {
    id: "amount",
    title: "Amount",
    fields: ["value", "per_month", "min_amount", "max_amount", "formula_expression"],
  },
  { id: "products", title: "Products", fields: ["applicable_product_ids", "conditions"] },
];

/** The save's message when a written formula hasn't passed the server's check yet. */
export const FORMULA_CHECK_PENDING = "Wait for the formula check to pass before saving.";

type FeeForm = Parameters<typeof buildFeePayload>[0];

export interface FeeStepInput {
  form: FeeForm;
  /** Written formulas switched on (NEXT_PUBLIC_ENABLE_FEE_FORMULAS). */
  expressions: boolean;
  /** The server's check of a written formula has passed. */
  formulaCheckValid: boolean;
}

/** Whether the fee is worked out by a written formula, as the dialog decides it. */
export function isWrittenFormula({ form, expressions }: Pick<FeeStepInput, "form" | "expressions">): boolean {
  return expressions && form.type === "formula" && form.formula?.mode === "expression";
}

function saveError(form: FeeForm, expressions: boolean): string | null {
  const result = buildFeePayload(form, { expressions });
  return "error" in result ? result.error : null;
}

/** The save's checks on one step's fields, keyed by the field to fix. */
export function feeStepErrors(stepId: string, input: FeeStepInput): StepErrors {
  const { form, expressions } = input;
  if (stepId === "details") {
    const error = saveError({ ...form, type: "fixed", value: "0", conditions: {}, formula: EMPTY_FORMULA_FIELDS }, expressions);
    return error ? { name: error } : {};
  }
  if (stepId === "amount") {
    const written = isWrittenFormula(input);
    const error = saveError({ ...form, name: "Fee", conditions: {} }, expressions);
    if (error) {
      const bounds = form.type === "formula" ? buildFormulaFields(form.formula ?? EMPTY_FORMULA_FIELDS) : null;
      const onBounds = bounds !== null && "error" in bounds && bounds.error === error;
      return { [onBounds ? "min_amount" : written ? "formula_expression" : "value"]: error };
    }
    return written && !input.formulaCheckValid ? { formula_expression: FORMULA_CHECK_PENDING } : {};
  }
  if (stepId === "products") {
    const error = saveError(
      { ...form, name: "Fee", type: "fixed", value: "0", formula: EMPTY_FORMULA_FIELDS },
      expressions,
    );
    return error ? { conditions: error } : {};
  }
  return {};
}
