/**
 * A public registration the server saved as a possible duplicate of a record
 * on file (finish run round 2, decision 3). The public form never refuses a
 * duplicate, so the review is where it's caught: the page names the match
 * when the server does, and asks the reviewer to confirm before approving.
 * Pure, so it runs under `tsx --test`.
 */
import { validationErrors } from "@/lib/api-error";
import { registrationCode } from "@/app/(app)/borrowers/_lib/registration-code";
import type {
  Registration,
  RegistrationPossibleDuplicate,
} from "@/services/registration.service";

export type PossibleDuplicate = RegistrationPossibleDuplicate;

type NamedDuplicate = Extract<PossibleDuplicate, { visible: true }>;

/** The member's page, or the other registration's review when it isn't a member yet. */
export function possibleDuplicateHref(duplicate: NamedDuplicate): string {
  return duplicate.is_member
    ? `/borrowers/${duplicate.id}`
    : `/borrowers/registrations/${duplicate.id}`;
}

/**
 * "BRW-000042 (Juan Dela Cruz)" for a member. A registration reads by the code
 * the Registrations list gives it ("PEND-0013", "REJ-0013"), never by a member
 * code it isn't using yet.
 */
export function possibleDuplicateLabel(duplicate: NamedDuplicate): string {
  const code = duplicate.is_member
    ? duplicate.borrower_code
    : registrationCode(duplicate.status === "rejected" ? "rejected" : "pending", duplicate.id);
  return `${code} (${duplicate.full_name})`;
}

/**
 * Whether approving waits for the reviewer's confirmation: the server refuses
 * it without one whenever it linked a possible duplicate, named or not.
 */
export function needsDuplicateConfirmation(
  registration: Pick<Registration, "possible_duplicate">,
): boolean {
  return registration.possible_duplicate != null;
}

/**
 * What the confirmation asks: the server's refusal when it sent one, else the
 * link's own words, which name the match only when the server did.
 */
export function duplicateConfirmationText(
  duplicate: PossibleDuplicate | null | undefined,
  refusal?: string | null,
): string {
  if (refusal) return refusal;
  if (!duplicate) {
    return "This registration may be a duplicate of someone already on file. Check before approving.";
  }
  if (!duplicate.visible) return duplicate.message;
  return `${duplicate.message} Approve this registration as a new member only once you've checked that it's a different person.`;
}

/** The approval's body once the reviewer has confirmed. */
export function acknowledgedApprovalPayload(payload: { branch_id?: number }): {
  branch_id?: number;
  acknowledge_possible_duplicate: true;
} {
  return { ...payload, acknowledge_possible_duplicate: true };
}

/** The server asking for the confirmation, in its own words, or null for any other error. */
export function possibleDuplicateRefusal(err: unknown): string | null {
  return validationErrors(err)?.possible_duplicate?.[0] ?? null;
}

/**
 * The server holding an approval because the registration's email is on
 * another member, in its own words, or null for any other error. No
 * confirmation gets past it: the email is changed or cleared in Edit Details.
 */
export function approvalEmailRefusal(err: unknown): string | null {
  return validationErrors(err)?.email?.[0] ?? null;
}
