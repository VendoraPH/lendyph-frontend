// "Send back for approval" on an approved, unreleased restructure (A1b): the
// server says whether it's offered, the reason follows the API's rule, and a
// refusal says whether the loan moved on. Dependency-free, so it runs under
// `tsx --test`.

import type { Loan } from "@/types/loan";

export const SEND_BACK_REASON_MAX = 1000;

/** The server's `can_send_back_approved`, and nothing else: the screen never decides it. */
export function canSendBackApproved(loan: Partial<Pick<Loan, "can_send_back_approved" | "status" | "is_restructure">>): boolean {
  return loan.can_send_back_approved === true;
}

/** Why the reason can't be sent as typed; null when it can. */
export function sendBackReasonError(reason: string): string | null {
  const typed = reason.trim();
  if (typed === "") return "Enter the reason for sending this restructure back for approval.";
  if (typed.length > SEND_BACK_REASON_MAX) return `The reason can be at most ${SEND_BACK_REASON_MAX} characters.`;
  return null;
}

export function sendBackApprovedPayload(reason: string): { reason: string } {
  return { reason: reason.trim() };
}

/**
 * After a refusal: "reload" when the loan moved on (409, another change saved
 * at the same time; or a 422 on `status`, e.g. already released), so the page
 * shows where it stands; "stay" otherwise, with the dialog and its reason kept.
 */
export function sendBackFailureAction(err: unknown): "reload" | "stay" {
  const response = (err as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } } | null)
    ?.response;
  if (response?.status === 409) return "reload";
  if (response?.status === 422 && response.data?.errors?.status !== undefined) return "reload";
  return "stay";
}
