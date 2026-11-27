import type { LoanApprovalEditState, LoanApprovalStep } from "@/types/loan-approval";

/**
 * The Chairman/Chairwoman's "Edit Loan" on the approval card (finish run
 * round 2, decision 14). Only the holder of `loans:edit_in_approval` sees it,
 * only while the loan is for approval and waits at an approve step, and only
 * when the server says this user may edit the loan at that very step now
 * (`GET /loans/{id}/approval-edit`). The server decides; the page only asks.
 */

/** The id of the approval card, where the edit returns to. */
export const APPROVAL_CARD_ID = "approval";

/**
 * The approval card's action rows: stacked below sm, right-aligned from sm,
 * and wrapping when they don't fit. At 1024x640 the approve step's four
 * actions (Edit Loan, the send-back target, Send Back for Revision, Approve &
 * Forward) are wider than the card, and a row that doesn't wrap pushed Edit
 * Loan out of it; at 1440 they still fit one row.
 */
export const APPROVAL_ACTIONS_ROW = "flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2";

/** Whether the page asks the server at all: the permission, a loan for approval, and an approve step waiting. */
export function asksApprovalEdit(input: {
  canEditInApproval: boolean;
  loanStatus: string | null | undefined;
  currentStep: Pick<LoanApprovalStep, "kind"> | null | undefined;
}): boolean {
  return input.canEditInApproval && input.loanStatus === "for_review" && input.currentStep?.kind === "approve";
}

/** Whether the approval card offers "Edit Loan": the server's yes, for the step on screen. */
export function offersApprovalEdit(input: {
  canEditInApproval: boolean;
  loanStatus: string | null | undefined;
  currentStep: Pick<LoanApprovalStep, "id" | "kind"> | null | undefined;
  state: LoanApprovalEditState | null;
}): boolean {
  if (!asksApprovalEdit(input) || !input.state?.can_edit) return false;
  return input.state.step?.id === input.currentStep?.id;
}

/**
 * The server's answer, or null when it isn't one: a malformed answer reads as
 * "no edit", never as a yes.
 */
export function readApprovalEditState(raw: unknown): LoanApprovalEditState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.can_edit !== "boolean") return null;
  const step = value.step as Record<string, unknown> | null | undefined;
  const readStep =
    step && typeof step === "object" && typeof step.id === "number" && typeof step.name === "string"
      ? { id: step.id, name: step.name }
      : null;
  const version = typeof value.version === "string" && value.version !== "" ? value.version : null;
  return {
    can_edit: value.can_edit && version !== null && readStep !== null,
    reason: typeof value.reason === "string" ? value.reason : null,
    step: readStep,
    version,
  };
}

/** The loan form, opened for the Chairman/Chairwoman's edit of this loan. */
export function approvalEditHref(loanId: number): string {
  return `/loans/new?edit=${loanId}&approval=1`;
}

/** The loan page, at its approval card. */
export function approvalCardHref(loanId: number): string {
  return `/loans/${loanId}#${APPROVAL_CARD_ID}`;
}
