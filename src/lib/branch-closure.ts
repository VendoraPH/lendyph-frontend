// Closing a branch (Phase 6, multi-branch decision 3): one user asks with an
// effective date and a reason, a different user approves or rejects, and the
// requester may cancel. The server's checklist says what keeps the branch
// open. The page hides what the server would refuse; the server decides.

import { formatCurrency, formatDate } from "@/lib/format";
import type { BranchStatus } from "@/lib/branch-status";

export type BranchClosureStatus = "pending" | "approved" | "rejected" | "cancelled";

export const CLOSURE_STATUS_LABELS: Record<BranchClosureStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export interface ClosurePerson {
  id: number;
  full_name: string;
}

/** `BranchClosureResource`. */
export interface BranchClosureRequest {
  id: number;
  branch_id: number;
  status: BranchClosureStatus;
  effective_on: string | null;
  reason: string;
  requested_by: ClosurePerson | null;
  requested_at: string | null;
  decided_by: ClosurePerson | null;
  decided_at: string | null;
  decision_note: string | null;
}

/** One line of `BranchStatus::checklist()`; `amount` is a 2-decimal peso string. */
export interface ClosureChecklistItem {
  key: string;
  label: string;
  count: number;
  amount: string | null;
  clear: boolean;
}

/** `GET /branches/{id}/closure`. */
export interface BranchClosureInfo {
  branch_id: number;
  status: BranchStatus;
  can_close: boolean;
  checklist: ClosureChecklistItem[];
  request: BranchClosureRequest | null;
}

const MAIN_OFFICE_STAYS_OPEN = "The main office stays open. Make another branch the main office first.";

/** One sentence for where the closure stands. */
export function closureState(info: BranchClosureInfo, branch: { is_main_office?: boolean }): string {
  if (info.status === "closed") return "This branch is closed.";
  if (info.request?.status === "pending") {
    const who = info.request.requested_by?.full_name ?? "Someone";
    const when = info.request.effective_on ? ` on ${formatDate(info.request.effective_on)}` : "";
    return `${CLOSURE_STATUS_LABELS.pending}: ${who} asked to close it${when}.`;
  }
  if (branch.is_main_office) return MAIN_OFFICE_STAYS_OPEN;
  if (info.can_close) return "Ready to close: nothing keeps this branch open.";
  const open = info.checklist.filter((item) => !item.clear).length;
  return `Can't close yet: ${open} ${open === 1 ? "item keeps" : "items keep"} this branch open.`;
}

/** "Open loans: 3", "Money in its cash and bank accounts: 2 (₱1,500.00)", "Assigned users: none". */
export function checklistItemWords(item: ClosureChecklistItem): string {
  if (item.count === 0) return `${item.label}: none`;
  return item.amount === null ? `${item.label}: ${item.count}` : `${item.label}: ${item.count} (${formatCurrency(item.amount)})`;
}

export interface ClosureActions {
  request: boolean;
  /** Why Ask to close is shown but can't be taken; null when it can. */
  requestDisabledReason: string | null;
  approve: boolean;
  reject: boolean;
  cancel: boolean;
}

/**
 * Who may act: everything needs branches:manage plus view_all (`mayManage`).
 * Ask while nothing waits, the branch isn't closed and isn't the main office;
 * approve or reject only as a different user from the requester; cancel only
 * as the requester.
 */
export function closureActions(
  info: BranchClosureInfo,
  branch: { is_main_office?: boolean },
  userId: number | null,
  mayManage: boolean,
): ClosureActions {
  const none: ClosureActions = { request: false, requestDisabledReason: null, approve: false, reject: false, cancel: false };
  if (!mayManage) return none;

  const waiting = info.request?.status === "pending" ? info.request : null;
  if (waiting) {
    const mine = userId !== null && waiting.requested_by?.id === userId;
    return { ...none, approve: !mine, reject: !mine, cancel: mine };
  }

  if (info.status === "closed" || branch.is_main_office) return none;
  return {
    ...none,
    request: true,
    requestDisabledReason: info.can_close ? null : "Clear every item on the checklist first.",
  };
}
