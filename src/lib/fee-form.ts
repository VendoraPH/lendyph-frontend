import type { CreateFeeData, FeeConditions, FeeType } from "@/types/fee";

interface FeeFormInput {
  name: string;
  type: FeeType;
  value: string;
  productIds: number[];
  conditions: FeeConditions;
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
export function buildFeePayload(form: FeeFormInput): { payload: CreateFeeData } | { error: string } {
  const value = Number(form.value);
  if (!form.name.trim()) return { error: "Enter a fee name." };
  if (!form.value.trim() || !Number.isFinite(value) || value < 0) {
    return { error: "Enter a fee amount or rate of zero or more." };
  }
  if (form.type === "percentage" && value > 100) {
    return { error: "A percentage fee cannot exceed 100% of the loan amount." };
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
    applicable_product_ids: form.productIds,
    // Omitting this field on PUT preserves the old rules on the API.
    conditions: Object.keys(conditions).length ? conditions : null,
  } };
}
