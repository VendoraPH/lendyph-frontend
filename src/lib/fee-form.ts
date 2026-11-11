import type { CreateFeeData, FeeConditions, FeeType } from "@/types/fee";
import { formatCurrency, formatRate } from "@/lib/format";
import { checkFeeFormula } from "@/lib/fee-expression";

/** The help line shown under a formula fee's fields on Fees. */
export const FORMULA_FEE_HELP =
  "Percentage of principal, optionally per month of the term, kept between the minimum and maximum.";

/** The help line shown above a formula fee's expression field. */
export const FORMULA_EXPRESSION_HELP =
  "Write the fee as arithmetic on the loan's figures. It is worked out from each loan's own values at release, then kept between the minimum and maximum.";

/**
 * A formula fee is either the rate recipe (a percentage of the principal) or,
 * where the deployment allows it, a written expression.
 */
export type FormulaMode = "rate" | "expression";

/** A formula fee's own fields as the form holds them: a flag and two peso inputs. */
export interface FormulaFieldsInput {
  perMonth: boolean;
  minAmount: string;
  maxAmount: string;
  mode?: FormulaMode;
  expression?: string;
}

export const EMPTY_FORMULA_FIELDS: FormulaFieldsInput = { perMonth: false, minAmount: "", maxAmount: "" };

export interface FormulaFieldsPayload {
  per_month: boolean;
  min_amount: number | null;
  max_amount: number | null;
  formula_expression?: string | null;
}

interface FeeFormInput {
  name: string;
  type: FeeType;
  value: string;
  productIds: number[];
  conditions: FeeConditions;
  /** Read only when `type` is "formula". */
  formula?: FormulaFieldsInput;
}

const PESO_PLACES = /^\d+(\.\d{1,2})?$/;

function boundValue(raw: string, label: string): { value: number | null } | { error: string } {
  const text = raw.trim();
  if (text === "") return { value: null };
  if (!PESO_PLACES.test(text)) {
    return { error: `${label} must be a peso amount of zero or more, with at most two decimals.` };
  }
  return { value: Number(text) };
}

/**
 * A formula fee's per-month flag and peso bounds, as the API takes them. A
 * blank bound is none (null); a bound is zero or more with at most two
 * decimals, as `fees.min_amount` / `max_amount` store it, and the minimum may
 * not exceed the maximum (the API's own 422).
 */
export function buildFormulaFields(input: FormulaFieldsInput): { fields: FormulaFieldsPayload } | { error: string } {
  const min = boundValue(input.minAmount, "Minimum");
  if ("error" in min) return min;
  const max = boundValue(input.maxAmount, "Maximum");
  if ("error" in max) return max;
  if (min.value !== null && max.value !== null && min.value > max.value) {
    return { error: `The minimum (${formatCurrency(min.value)}) cannot be more than the maximum (${formatCurrency(max.value)}).` };
  }
  return { fields: { per_month: input.perMonth, min_amount: min.value, max_amount: max.value } };
}

/**
 * How a formula fee reads in a list: "1.5% per month · min ₱150.00 · max
 * ₱1,500.00". The rule only; the amount it comes to is the server's.
 */
export function describeFormulaFee(fee: { value: number | string; per_month?: boolean | null; min_amount?: number | string | null; max_amount?: number | string | null; formula_expression?: string | null }): string {
  const parts = [fee.formula_expression || `${formatRate(fee.value)}%${fee.per_month ? " per month" : ""}`];
  if (fee.min_amount != null) parts.push(`min ${formatCurrency(fee.min_amount)}`);
  if (fee.max_amount != null) parts.push(`max ${formatCurrency(fee.max_amount)}`);
  return parts.join(" · ");
}

/** Human labels for the two condition families, so errors can name the field. */
const CONDITION_LABELS = {
  term_days: "Term days",
  loan_amount: "Loan amount",
} as const;

/**
 * Validate the fee dialog's fields and shape them into an API payload.
 *
 * Two of the rules below are deliberately stricter than the API, which
 * validates the six condition keys independently and caps nothing:
 *
 * - **Percentage ceiling.** `value` is `numeric|min:0` server-side, so a
 *   percentage fee of `500` is accepted and then charged as 500% of the
 *   principal at release. Nothing downstream catches it.
 * - **Contradictory conditions.** The backend evaluates every populated key as
 *   a conjunction, so `term_days_gt: 30` with `term_days_eq: 30` is storable
 *   and can never match — the fee is silently dormant. `LoanReleaseFeeService`
 *   documents this as intentional at release time (a release is the wrong
 *   moment to discover a settings mistake) and names this screen as where it
 *   should surface instead.
 *
 * The second rule therefore stays, but reports the offending pair by name and
 * value: the old message said only "the conditions conflict", which left an
 * already-saved contradictory fee looking un-editable because no unrelated
 * edit could get past it without knowing which two numbers to fix.
 */
export function buildFeePayload(
  form: FeeFormInput,
  options: { expressions?: boolean } = {},
): { payload: CreateFeeData } | { error: string } {
  if (!form.name.trim()) return { error: "Enter a fee name." };
  const fields = form.formula ?? EMPTY_FORMULA_FIELDS;
  // A written expression replaces the rate: `value` is stored as 0 and unused.
  const writtenFormula = form.type === "formula" && options.expressions && fields.mode === "expression";
  const value = writtenFormula ? 0 : Number(form.value);
  if (!writtenFormula) {
    if (!form.value.trim() || !Number.isFinite(value) || value < 0) {
      return { error: "Enter a fee amount or rate of zero or more." };
    }
    if (form.type !== "fixed" && value > 100) {
      return { error: "A percentage fee cannot exceed 100% of the loan amount." };
    }
  }
  let formula: FormulaFieldsPayload | null = null;
  if (form.type === "formula") {
    const result = buildFormulaFields(fields);
    if ("error" in result) return result;
    formula = result.fields;
    if (writtenFormula) {
      const check = checkFeeFormula(fields.expression ?? "");
      if (!check.ok) return { error: `Fee formula: ${check.error}` };
      formula = { ...formula, per_month: false, formula_expression: check.expression };
    } else if (options.expressions) {
      // Switching a written formula back to the rate recipe clears it.
      formula = { ...formula, formula_expression: null };
    }
  }
  for (const [key, limit] of Object.entries(form.conditions)) {
    if (limit == null) continue;
    if (!Number.isFinite(limit) || limit < 0 || (key.startsWith("term_days") && !Number.isInteger(limit))) {
      return { error: "Conditions must be zero or more; term days must be whole numbers." };
    }
  }
  for (const prefix of ["term_days", "loan_amount"] as const) {
    const label = CONDITION_LABELS[prefix];
    const gt = form.conditions[`${prefix}_gt`];
    const lt = form.conditions[`${prefix}_lt`];
    const eq = form.conditions[`${prefix}_eq`];
    if (gt != null && lt != null && gt >= lt) {
      return { error: `${label}: "greater than" (${gt}) must be below "less than" (${lt}). No loan can satisfy both, so the fee would never apply.` };
    }
    if (eq != null && gt != null && eq <= gt) {
      return { error: `${label}: "equal to" (${eq}) must be above "greater than" (${gt}). No loan can satisfy both, so the fee would never apply.` };
    }
    if (eq != null && lt != null && eq >= lt) {
      return { error: `${label}: "equal to" (${eq}) must be below "less than" (${lt}). No loan can satisfy both, so the fee would never apply.` };
    }
  }
  const conditions = Object.fromEntries(Object.entries(form.conditions).filter(([, limit]) => limit != null));
  return { payload: {
    name: form.name.trim(), type: form.type, value,
    // Only a formula fee sends these; the API clears them on any other type.
    ...formula,
    applicable_product_ids: form.productIds,
    // Omitting this field on PUT preserves the old rules on the API.
    conditions: Object.keys(conditions).length ? conditions : null,
  } };
}
