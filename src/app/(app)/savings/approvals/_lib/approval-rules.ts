import { formatCurrency } from "@/lib/format";
import { feeOf, totalWithFeeOf } from "@/lib/savings/withdrawal-fee";
import type { SavingsApproval } from "@/types";

export interface ApprovalOffer {
  /** Why the caller can't approve, or null when they can. */
  approveBlocked: string | null;
  /** Why the caller can't reject, or null when they can. */
  rejectBlocked: string | null;
  /** The maker may withdraw their own pending request (with `savings:transact`). */
  canCancel: boolean;
}

/**
 * What the caller may do with an approval (maker-checker, savings design §2).
 * The maker never approves or rejects their own request, and above the second
 * tier a checker who has already approved can't approve again: a different
 * checker must. The server refuses the same (403); this only says why first.
 */
export function approvalOffer(approval: SavingsApproval, userId: number | null | undefined): ApprovalOffer {
  if (approval.status !== "pending") {
    const done = "This request has been decided.";
    return { approveBlocked: done, rejectBlocked: done, canCancel: false };
  }
  const isMaker = userId != null && approval.requested_by?.id === userId;
  if (isMaker) {
    const own = "You made this request; another user must decide it.";
    return { approveBlocked: own, rejectBlocked: own, canCancel: true };
  }
  const alreadyApproved = userId != null && approval.first_checker?.id === userId;
  return {
    approveBlocked: alreadyApproved ? "You have already approved this request; a different approver must approve it too." : null,
    rejectBlocked: null,
    canCancel: false,
  };
}

/** "1 of 2 approvals" once the first checker has approved; null for a one-checker request. */
export function approvalProgress(approval: Pick<SavingsApproval, "required_checkers" | "first_checker" | "status">): string | null {
  if (approval.required_checkers < 2) return null;
  const given = approval.status === "approved" ? approval.required_checkers : approval.first_checker ? 1 : 0;
  return `${given} of ${approval.required_checkers} approvals`;
}

/** What the request is about: the account number or certificate, and the reversed line if any. */
export function approvalSubject(approval: SavingsApproval): string {
  const parts = [approval.account_number ?? approval.certificate_number ?? null, approval.target_reference ?? null];
  return parts.filter(Boolean).join(" · ") || "—";
}

/** Where the request's record lives. */
export function approvalHref(approval: SavingsApproval): string | null {
  if (approval.time_deposit_id) return `/savings/time-deposits/${approval.time_deposit_id}`;
  if (approval.account_id) return `/savings/accounts/${approval.account_id}`;
  return null;
}

/** True when the server answered with an HTTP status (a refusal), as opposed to no reply at all. */
export function serverAnswered(err: unknown): boolean {
  return typeof (err as { response?: { status?: unknown } } | null)?.response?.status === "number";
}

/** The amount column: a reactivation moves no money, so it reads a dash rather than ₱0.00. */
export function approvalAmountText(approval: Pick<SavingsApproval, "kind" | "amount">): string {
  return approval.kind === "reactivation" ? "—" : formatCurrency(approval.amount);
}

/** The excess-withdrawal fee the request carries besides its amount, and the server's total with it; null when none. */
export function approvalFeeText(approval: Pick<SavingsApproval, "fee_amount" | "total_with_fee">): string | null {
  const fee = feeOf(approval);
  if (!fee) return null;
  const total = totalWithFeeOf(approval);
  return `Excess-withdrawal fee ${formatCurrency(fee)}${total ? ` · ${formatCurrency(total)} in all` : ""}`;
}
