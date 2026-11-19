// A branch's status and the action that changes it (Phase 6, multi-branch
// decision 2). Pure, so the page's rules are unit-tested.
//
// MB-BE1 gives branches a status (active, suspended or closed) and makes
// `PUT /branches/{id}` refuse a changed `is_active`. Suspending and
// reactivating go through `PATCH /branches/{id}/status` with a reason;
// closing goes through the closure request, never here.

import { LOAN_STATUS_COLORS } from "@/constants/loan-status";
import type { Permission } from "@/types";

export type BranchStatus = "active" | "suspended" | "closed";

export const BRANCH_STATUS_LABELS: Record<BranchStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  closed: "Closed",
};

/** The app's status colours: active reads like a current loan, suspended like one waiting, closed like a closed one. */
export const BRANCH_STATUS_COLORS: Record<BranchStatus, string> = {
  active: LOAN_STATUS_COLORS.released,
  suspended: LOAN_STATUS_COLORS.for_review,
  closed: LOAN_STATUS_COLORS.closed,
};

/** The fields these rules read; a branch from any backend has `is_active`. */
export interface BranchStatusFields {
  status?: BranchStatus;
  is_active: boolean;
  is_main_office?: boolean;
}

/** The server's status; a backend before MB-BE1 sends only `is_active` (and MB-BE1 turns inactive into suspended). */
export function branchStatusOf(branch: BranchStatusFields): BranchStatus {
  return branch.status ?? (branch.is_active ? "active" : "suspended");
}

/** `BranchStatusRequest::mayChangeStatus`: branches:manage plus branches:view_all. */
export function mayChangeBranchStatus(can: (permission: Permission) => boolean): boolean {
  return can("branches:manage") && can("branches:view_all");
}

export interface BranchStatusAction {
  target: Exclude<BranchStatus, "closed">;
  label: "Suspend" | "Reactivate";
  /** Why the action is offered but can't be taken; null when it can. */
  disabledReason: string | null;
}

/** `BranchStatus::change()`'s refusal for the main office, so the page says it before the server would. */
export const MAIN_OFFICE_STAYS_ACTIVE = "The main office stays active. Make another branch the main office first.";

/**
 * Suspend for an active branch, Reactivate for a suspended one, nothing for a
 * closed one (a closed branch stays closed). The main office stays active, so
 * its Suspend is shown disabled with the reason.
 */
export function branchStatusAction(branch: BranchStatusFields): BranchStatusAction | null {
  const status = branchStatusOf(branch);
  if (status === "closed") return null;
  if (status === "suspended") return { target: "active", label: "Reactivate", disabledReason: null };
  return {
    target: "suspended",
    label: "Suspend",
    disabledReason: branch.is_main_office ? MAIN_OFFICE_STAYS_ACTIVE : null,
  };
}
