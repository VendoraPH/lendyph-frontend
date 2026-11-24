/**
 * What the application page offers, by the merged backend's rules
 * (ApplicationTransitions, StaffProcessing and the hand-off). The server is
 * the authority: the status moves are its `allowed_transitions`, and every
 * action it refuses comes back in its own words.
 */

import { httpStatusOf } from "@/lib/api-error";
import { isClosed, isUnsubmitted } from "@/lib/loan-origination";
import type { Permission } from "@/types";
import type {
  ApplicationDetail,
  ApplicationStatus,
  DocumentRequirement,
  StaffDocument,
  TransitionInput,
} from "@/types/loan-origination";
import { FORM_FIELDS } from "./form-fields";
import { words } from "./words";

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

/** Keys a missing-field list can name that aren't text or choice fields. */
const OTHER_FIELD_WORDS: Record<string, string> = {
  "expenses.has_existing_loans": "Existing loans",
  "expenses.existing_loans": "Existing loans",
  "loan.loan_product_id": "Loan product",
};

const EXISTING_LOAN_WORDS: Record<string, string> = {
  institution: "lender",
  outstanding_balance: "balance",
  payment_amount: "payment",
  payment_frequency: "how often paid",
  remaining_term: "remaining term",
};

/** A missing field the server names (`personal.gender`), in words. */
export function missingFieldLabel(key: string): string {
  const known = FORM_FIELDS.find((f) => f.key === key)?.label ?? OTHER_FIELD_WORDS[key];
  if (known) return known;
  const loan = /^expenses\.existing_loans\.(\d+)(?:\.(\w+))?$/.exec(key);
  if (loan) {
    const number = String(Number(loan[1]) + 1);
    return loan[2] ? `Existing loan ${number}: ${EXISTING_LOAN_WORDS[loan[2]] ?? words(loan[2]).toLowerCase()}` : `Existing loan ${number}`;
  }
  return words(key.split(".").at(-1) ?? key);
}

/** What a 404 on one application means: no such application, or another branch's. */
export const NOT_FOUND = "This application doesn't exist or you can't see it.";

/** An application the server answered 404 for. */
export interface MissingApplication {
  missing: true;
}

const MISSING: MissingApplication = { missing: true };

export function isMissing(value: unknown): value is MissingApplication {
  return value === MISSING;
}

/**
 * One application, or `MissingApplication` when the server answers 404 (it
 * doesn't exist, or it is another branch's). Any other failure stays an
 * error, so only a 501 reads as "not connected yet".
 */
export function orMissing<T>(load: Promise<T>): Promise<T | MissingApplication> {
  return load.catch((err: unknown) => {
    if (httpStatusOf(err) === 404) return MISSING;
    throw err;
  });
}

export interface RequestableDocument {
  type: string;
  label: string;
  /** The application's own copy, in the server's words; null when it has none. */
  status: string | null;
}

/**
 * The document types an information request can ask for: every type in the
 * module's settings, in their order, the only ones the server accepts. Each
 * says where the application's own copy stands.
 */
export function requestableDocumentTypes(
  types: readonly DocumentRequirement[],
  documents: readonly Pick<StaffDocument, "type" | "status_label">[],
): RequestableDocument[] {
  return types.map((t) => ({
    type: t.type,
    label: t.label,
    status: documents.find((d) => d.type === t.type)?.status_label ?? null,
  }));
}
