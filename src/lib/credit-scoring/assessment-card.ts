import { getErrorMessage, getFieldErrors, httpStatusOf } from "@/lib/api-error";
import type { Permission } from "@/types";
import type {
  CreditApplicationProfile,
  IncomeVerification,
  SaveLoanAssessmentData,
} from "@/types/credit-scoring";

/** Draft and for-approval loans: the statuses the server lets an assessment be saved on. */
export const ASSESSABLE_STATUSES: readonly string[] = ["draft", "for_review"];

export const SAVE_BLOCKED_REASON = "Saving the assessment needs permission to edit loans.";

type Can = (permission: Permission) => boolean;

/**
 * Whether the loan page's Credit Assessment card renders at all. When it
 * doesn't, it sends no request either.
 */
export function showsCreditAssessment({
  flagOn,
  status,
  can,
}: {
  flagOn: boolean;
  status: string | null | undefined;
  can: Can;
}): boolean {
  return (
    flagOn &&
    !!status &&
    ASSESSABLE_STATUSES.includes(status) &&
    can("credit_scoring:view") &&
    can("loans:view")
  );
}

/** The PUT needs credit_scoring:view, loans:view and loans:update. */
export function canSaveAssessment(can: Can): boolean {
  return can("credit_scoring:view") && can("loans:view") && can("loans:update");
}

export const ASSESSMENT_TEXT_FIELDS = [
  "other_income",
  "business_income",
  "household_expenses",
  "outside_debt_payments",
  "outside_lenders_count",
  "employment_status",
  "business_start_date",
  "years_at_residence",
  "verified_references_count",
] as const;

export type AssessmentTextField = (typeof ASSESSMENT_TEXT_FIELDS)[number];

export type AssessmentForm = Record<AssessmentTextField, string> & {
  income_verification: IncomeVerification | "";
  notice_acknowledged: boolean;
};

export function assessmentFormFrom(profile: CreditApplicationProfile | null): AssessmentForm {
  const text = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const form = Object.fromEntries(
    ASSESSMENT_TEXT_FIELDS.map((key) => [key, text(profile?.[key])]),
  ) as Record<AssessmentTextField, string>;
  return {
    ...form,
    income_verification: profile?.income_verification ?? "",
    notice_acknowledged: profile?.notice_acknowledged ?? false,
  };
}

/** The PUT body: every field as typed, an empty one cleared to null. */
export function assessmentBody(form: AssessmentForm): SaveLoanAssessmentData {
  const body: SaveLoanAssessmentData = {};
  for (const key of ASSESSMENT_TEXT_FIELDS) {
    const value = form[key].trim();
    body[key] = value === "" ? null : value;
  }
  body.income_verification = form.income_verification === "" ? null : form.income_verification;
  body.notice_acknowledged = form.notice_acknowledged;
  return body;
}

/**
 * What a failed save shows on the card: every 422 field message (the server's
 * own words), or the 409 or other reason in one line.
 */
export function assessmentSaveErrors(err: unknown): string[] {
  if (httpStatusOf(err) === 422) {
    const fields = getFieldErrors(err);
    if (fields.length > 0) return fields;
  }
  return [getErrorMessage(err, "Unable to save the credit assessment.")];
}
