/**
 * "Submit for approval", the hand-off (ApplicationHandOff, LO-B4): it links
 * or creates the member, creates the draft loan through the loan code and
 * submits it into the approval chain. The server checks everything again;
 * these rules only decide what the dialog offers and how it reads a refusal.
 */

import { getErrorMessage, httpStatusOf, validationErrors } from "@/lib/api-error";
import type { Permission } from "@/types";
import type { HandOffInput } from "@/types/loan-origination";

export interface HandOffForm {
  /** `YYYY-MM-DD`, or blank for today. */
  startDate: string;
  /** "Create anyway": staff chose to create the member despite a match. */
  forceNewMember: boolean;
}

/** The body: the version read, then only what staff chose. */
export function handOffPayload(version: number, form: HandOffForm): HandOffInput {
  return {
    version,
    ...(form.startDate ? { start_date: form.startDate } : {}),
    ...(form.forceNewMember ? { force_new_member: true } : {}),
  };
}

/**
 * Why this user can't hand the application off, in the server's words
 * (ApplicationHandOff::authorize()), or null: `loan_origination:convert` and
 * `loans:create`, plus `borrowers:create` when the hand-off creates the
 * member (no member is linked).
 */
export function handOffBlocker(can: (permission: Permission) => boolean, createsMember: boolean): string | null {
  if (!can("loan_origination:convert") || !can("loans:create")) {
    return "Moving an application to For Approval needs the permission to hand applications off and the permission to create loans.";
  }
  if (createsMember && !can("borrowers:create")) {
    return "Handing this application off creates its member, which needs the permission to create members.";
  }
  return null;
}

export interface HandOffRefusal {
  /** The server's words, each once. */
  messages: string[];
  /** The applicant matches a member on record (`errors.member`): link them, or create anyway. */
  duplicateMember: boolean;
  /** A repeat names the loan the application already became. */
  loanId: number | null;
  /** A 409: the application changed or was handed off meanwhile, so the page reloads it. */
  stale: boolean;
}

const FALLBACK = "Could not submit the application for approval.";

/** A failed hand-off, read for the dialog. */
export function handOffRefusal(err: unknown): HandOffRefusal {
  const errors = validationErrors(err);
  if (errors) {
    const messages = [...new Set(Object.values(errors).flat())];
    return {
      messages: messages.length > 0 ? messages : [getErrorMessage(err, FALLBACK)],
      duplicateMember: (errors.member ?? []).length > 0,
      loanId: null,
      stale: false,
    };
  }

  const stale = httpStatusOf(err) === 409;
  const body = (err as { response?: { data?: { loan_id?: unknown } } } | null)?.response?.data;
  return {
    messages: [getErrorMessage(err, FALLBACK)],
    duplicateMember: false,
    loanId: stale && typeof body?.loan_id === "number" ? body.loan_id : null,
    stale,
  };
}

/** "Create anyway" is offered only to `borrowers:create` holders, when the hand-off creates the member. */
export function canCreateAnyway(
  refusal: HandOffRefusal,
  can: (permission: Permission) => boolean,
  linkedMemberId: number | null,
): boolean {
  return refusal.duplicateMember && linkedMemberId === null && can("borrowers:create");
}
