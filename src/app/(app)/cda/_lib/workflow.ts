import type { Permission } from "@/types";
import type { CdaReportStatus, CdaWorkflowAction } from "@/types/cda";

/**
 * The report workflow, client side. The server enforces it; this only decides
 * which buttons to offer, so a user is never shown a step the API will refuse.
 *
 *   draft ─validate→ (validation_failed | draft) ─submit_for_review→ for_review
 *   for_review ─return→ returned ─(edit)→ draft      for_review ─approve→ approved
 *   approved ─finalize→ finalized (locked, snapshot + checksum)
 *   finalized ─mark_submitted→ submitted ─→ accepted | correction_required
 *   finalized | submitted | correction_required ─reopen (reason)→ draft
 */
const TRANSITIONS: Record<CdaReportStatus, CdaWorkflowAction[]> = {
  not_started: ["validate"],
  draft: ["validate", "submit_for_review"],
  validation_failed: ["validate"],
  returned: ["validate", "submit_for_review"],
  for_review: ["return", "approve"],
  approved: ["finalize", "return"],
  finalized: ["mark_submitted", "reopen"],
  submitted: ["mark_accepted", "mark_correction_required", "reopen"],
  correction_required: ["reopen"],
  accepted: [],
};

export const ACTION_PERMISSION: Record<CdaWorkflowAction, Permission> = {
  validate: "cda:prepare",
  submit_for_review: "cda:prepare",
  return: "cda:review",
  approve: "cda:approve",
  finalize: "cda:finalize",
  reopen: "cda:reopen",
  mark_submitted: "cda:submit",
  mark_accepted: "cda:submit",
  mark_correction_required: "cda:submit",
};

export const ACTION_LABEL: Record<CdaWorkflowAction, string> = {
  validate: "Run validation",
  submit_for_review: "Submit for review",
  return: "Return for changes",
  approve: "Approve",
  finalize: "Finalize",
  reopen: "Reopen",
  mark_submitted: "Mark submitted",
  mark_accepted: "Mark accepted",
  mark_correction_required: "Correction required",
};

/** Actions that must carry a written reason, which the audit trail keeps. */
export const REASON_REQUIRED: ReadonlySet<CdaWorkflowAction> = new Set([
  "return",
  "reopen",
  "mark_correction_required",
]);

export function availableActions(status: CdaReportStatus): CdaWorkflowAction[] {
  return TRANSITIONS[status];
}

/**
 * Whether `action` can be taken now. Submitting for review and finalizing are
 * blocked while any Critical issue is open; warnings never block.
 */
export function canTakeAction(
  action: CdaWorkflowAction,
  status: CdaReportStatus,
  criticalCount: number,
): boolean {
  if (!TRANSITIONS[status].includes(action)) return false;
  if ((action === "submit_for_review" || action === "finalize") && criticalCount > 0) return false;
  return true;
}

/** Finalized and later are locked: values change only after a reopen. */
export function isLocked(status: CdaReportStatus): boolean {
  return ["finalized", "submitted", "accepted", "correction_required"].includes(status);
}

/** Done for deadline purposes: filed with CDA. */
export function isFiled(status: CdaReportStatus): boolean {
  return status === "submitted" || status === "accepted";
}
