/**
 * What the application page offers, by the merged backend's rules
 * (ApplicationTransitions, StaffProcessing and the hand-off). The server is
 * the authority: the status moves are its `allowed_transitions`, and every
 * action it refuses comes back in its own words.
 */

import { isClosed, isUnsubmitted } from "@/lib/loan-origination";
import type { Permission } from "@/types";
import type { ApplicationDetail, ApplicationStatus, TransitionInput } from "@/types/loan-origination";

export type ApplicationAction =
  | "open_loan"
  | "hand_off"
  | "change_status"
  | "request_information"
  | "assign"
  | "link_member"
  | "remind"
  | "note";

/** The statuses an information request is taken from (StaffProcessing::INFORMATION_FROM). */
export const INFORMATION_STATUSES: readonly ApplicationStatus[] = [
  "submitted",
  "document_verification",
  "under_assessment",
  "additional_info_required",
];

/**
 * The buttons for an application, in order. Once the hand-off set `loan_id`
 * the application follows its loan: the page opens the loan and takes notes,
 * with no status actions. A closed application only takes notes.
 */
export function applicationActions(
  a: Pick<ApplicationDetail, "status" | "loan_id" | "allowed_transitions">,
): ApplicationAction[] {
  if (a.loan_id !== null) return ["open_loan", "note"];
  if (isClosed(a.status)) return ["note"];

  const actions: ApplicationAction[] = [];
  if (a.status === "under_assessment") actions.push("hand_off");
  if (a.allowed_transitions.length > 0) actions.push("change_status");
  if (INFORMATION_STATUSES.includes(a.status)) actions.push("request_information");
  actions.push("assign", "link_member");
  if (isUnsubmitted(a.status)) actions.push("remind");
  actions.push("note");
  return actions;
}

/** A rejection or withdrawal keeps its reason in the history. */
export function transitionNeedsNote(to: ApplicationStatus): boolean {
  return to === "rejected" || to === "withdrawn";
}

/**
 * `POST …/transition`: the move, the version read, the internal note and the
 * message for the applicant (logged, never sent), each left out when blank.
 */
export function transitionPayload(
  to: ApplicationStatus,
  version: number,
  note: string,
  applicantMessage: string,
): TransitionInput {
  const internal = note.trim();
  const message = applicantMessage.trim();
  return {
    to,
    version,
    ...(internal ? { note: internal } : {}),
    ...(message ? { applicant_message: message } : {}),
  };
}

/** Why "Link member" is out of reach, in the server's words (StaffAccess), or null. */
export function linkMemberBlocker(can: (permission: Permission) => boolean): string | null {
  if (!can("loan_origination:update")) {
    return "Working on online applications needs the permission to update online applications.";
  }
  if (!can("borrowers:view")) {
    return "Member matches show members' records, so they need the permission to view members.";
  }
  return null;
}

/** The application form's fields in words, by the server's `section.field` keys (DraftRules). */
const FIELD_WORDS: Record<string, string> = {
  "personal.first_name": "First name",
  "personal.middle_name": "Middle name",
  "personal.last_name": "Last name",
  "personal.suffix": "Suffix",
  "personal.date_of_birth": "Date of birth",
  "personal.gender": "Gender",
  "personal.civil_status": "Civil status",
  "personal.nationality": "Nationality",
  "personal.region": "Region",
  "personal.province": "Province",
  "personal.city": "City or municipality",
  "personal.barangay": "Barangay",
  "personal.street_address": "Street address",
  "personal.postal_code": "Postal code",
  "personal.years_at_residence": "Years at address",
  "personal.residence_ownership": "Residence",
  "personal.dependents": "Dependents",
  "personal.membership_number": "Membership number",
  "employment.income_source": "Income source",
  "employment.employer_name": "Employer",
  "employment.employment_type": "Employment type",
  "employment.job_title": "Job title",
  "employment.years_employed": "Years employed",
  "employment.employer_address": "Employer address",
  "employment.gross_monthly_income": "Gross monthly pay",
  "employment.net_monthly_income": "Take-home pay a month",
  "employment.other_regular_income": "Other regular income",
  "employment.salary_frequency": "How often paid",
  "employment.business_name": "Business name",
  "employment.business_type": "Business type",
  "employment.business_address": "Business address",
  "employment.years_operating": "Years operating",
  "employment.monthly_revenue": "Average sales a month",
  "employment.monthly_business_expenses": "Business costs a month",
  "employment.monthly_net_business_income": "Net business income a month",
  "employment.other_source_description": "Source of income",
  "employment.other_income_amount": "Income amount",
  "employment.other_income_frequency": "How often income is received",
  "employment.other_income_details": "Income details",
  "expenses.has_existing_loans": "Existing loans",
  "expenses.existing_loans": "Existing loans",
  "loan.loan_product_id": "Loan product",
  "loan.amount": "Loan amount",
  "loan.purpose": "Loan purpose",
  "loan.term": "Term",
  "loan.frequency": "Payment frequency",
  "loan.release_method": "Release method",
};

const EXISTING_LOAN_WORDS: Record<string, string> = {
  institution: "lender",
  outstanding_balance: "balance",
  payment_amount: "payment",
  payment_frequency: "how often paid",
  remaining_term: "remaining term",
};

/** "snake_case" as a sentence-case phrase. */
function words(key: string): string {
  const text = key.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A missing field the server names (`personal.gender`), in words. */
export function missingFieldLabel(key: string): string {
  if (FIELD_WORDS[key]) return FIELD_WORDS[key];
  const loan = /^expenses\.existing_loans\.(\d+)(?:\.(\w+))?$/.exec(key);
  if (loan) {
    const number = String(Number(loan[1]) + 1);
    return loan[2] ? `Existing loan ${number}: ${EXISTING_LOAN_WORDS[loan[2]] ?? words(loan[2]).toLowerCase()}` : `Existing loan ${number}`;
  }
  return words(key.split(".").at(-1) ?? key);
}
