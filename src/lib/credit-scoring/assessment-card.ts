import { getErrorMessage, getFieldErrors, httpStatusOf } from "@/lib/api-error";
import type { Permission } from "@/types";
import type {
  CreditApplicationProfile,
  LoanCreditAssessment,
  IncomeVerification,
  SaveLoanAssessmentData,
} from "@/types/credit-scoring";

/** Draft and for-approval loans: the statuses the server lets an assessment be saved on. */
export const ASSESSABLE_STATUSES: readonly string[] = ["draft", "for_review"];

export const SAVE_BLOCKED_REASON = "Saving the assessment needs permission to edit loans.";

export const NO_SCORE_DECISION_REASON = "Save the application's details to score it first.";

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

/**
 * The application figures the server hides from a caller without
 * `borrowers:view` or the member's branch: they arrive as null then.
 */
export const MEMBER_DETAIL_FIELDS: readonly AssessmentTextField[] = [
  "other_income",
  "household_expenses",
  "outside_debt_payments",
];

export const MEMBER_DETAILS_HIDDEN_TEXT = "Hidden (needs access to member details)";

/**
 * Whether the member-detail figures are hidden from this caller: the server's
 * `application_figures_hidden` (borrowers:view and the member's branch), or,
 * on an API that doesn't send it yet, a missing borrowers:view.
 */
export function memberDetailsHidden(
  assessment: Pick<Partial<LoanCreditAssessment>, "application_figures_hidden">,
  can: Can,
): boolean {
  return assessment.application_figures_hidden === true || !can("borrowers:view");
}

/**
 * The PUT body: each field that differs from how it loaded, as typed, and an
 * emptied one as null. The server leaves out-of-body fields unchanged, so a
 * figure the caller can't see (sent to them as null) is never cleared by a
 * save. While member details are hidden their figures are never sent at all.
 *
 * `notice_acknowledged` follows the same rule. The server clears a stored
 * acknowledgement on false, and the box loads unticked for a member who
 * acknowledged an earlier notice version, so sending it on every save would
 * erase that earlier consent.
 */
export function assessmentBody(
  form: AssessmentForm,
  loaded: AssessmentForm,
  { memberDetailsHidden: hidden = false }: { memberDetailsHidden?: boolean } = {},
): SaveLoanAssessmentData {
  const body: SaveLoanAssessmentData = {};
  for (const key of ASSESSMENT_TEXT_FIELDS) {
    if (hidden && MEMBER_DETAIL_FIELDS.includes(key)) continue;
    const value = form[key].trim();
    if (value === loaded[key].trim()) continue;
    body[key] = value === "" ? null : value;
  }
  if (form.income_verification !== loaded.income_verification) {
    body.income_verification = form.income_verification === "" ? null : form.income_verification;
  }
  if (form.notice_acknowledged !== loaded.notice_acknowledged) {
    body.notice_acknowledged = form.notice_acknowledged;
  }
  return body;
}

export type NoticeStatus =
  | { kind: "none" }
  | { kind: "current" | "earlier"; version: string; at: string };

/** Whether, and under which notice version, the member acknowledged the privacy notice. */
export function noticeStatus(profile: CreditApplicationProfile | null): NoticeStatus {
  if (!profile?.notice_acknowledged_at || profile.notice_version === null) return { kind: "none" };
  return {
    kind: profile.notice_acknowledged ? "current" : "earlier",
    version: String(profile.notice_version),
    at: profile.notice_acknowledged_at,
  };
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
