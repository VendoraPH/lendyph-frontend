import type {
  CdaApprovalStep,
  CdaApprovalStepStatus,
  CdaCalendarRow,
  CdaRequirement,
  CdaRequirementInput,
  CdaRequirementStatus,
  CdaWorkflowInput,
} from "@/types/cda";
import { roleLabelFromServer } from "@/lib/role-display-name";
import { HISTORY_ACTION_LABELS, UNKNOWN_LABEL, type Tone } from "./labels";

/**
 * The CDA review chain on a report (gap round B6) and the custom compliance
 * calendar items, in words. Who may approve or return is the server's
 * (`available_actions`); these only name what the server sent.
 */

/** A review step's status in words (`CdaReportApprovalStep` statuses). */
export const STEP_STATUS_META: Record<CdaApprovalStepStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting", tone: "neutral" },
  pending: { label: "Awaiting approval", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  returned: { label: "Returned for changes", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function stepStatusMeta(status: string | null | undefined): { label: string; tone: Tone } {
  return status && Object.hasOwn(STEP_STATUS_META, status)
    ? STEP_STATUS_META[status as CdaApprovalStepStatus]
    : { label: UNKNOWN_LABEL, tone: "neutral" };
}

/** History rows, with an earlier review step's approval (`approve_step`). */
export const REVIEW_HISTORY_LABELS: Record<string, string> = {
  ...HISTORY_ACTION_LABELS,
  approve_step: "Approved a review step",
};

export interface ReviewRound {
  round: number;
  /** The round ended: a return, a return from approved or a reopen. */
  closed: boolean;
  /** The step waiting for an approval now, or null. */
  pending: CdaApprovalStep | null;
}

/** The report's latest review round as the server sent it, or null on the single review. */
export function reviewRound(steps: readonly CdaApprovalStep[] | null | undefined): ReviewRound | null {
  if (!steps || steps.length === 0) return null;
  const pending = steps.find((s) => s.status === "pending" && !s.closed) ?? null;
  return { round: steps[0].round, closed: steps.every((s) => s.closed), pending };
}

const same = (a: number | string | null | undefined, b: number | string | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

/**
 * Why Approve isn't offered to a user who holds `cda:approve`, in the
 * server's own words, from the report's facts: they sent it for review, they
 * approved an earlier step of this round, or the pending step is for another
 * role. Null when Approve is offered, or there is nothing to explain.
 */
export function approveNote(
  report: {
    status: string;
    available_actions: readonly string[];
    submitted_for_review_by: { id: number } | null;
    approval_steps?: readonly CdaApprovalStep[] | null;
  },
  userId: number | string | null | undefined,
  canApprove: boolean,
): string | null {
  if (report.status !== "for_review" || !canApprove || report.available_actions.includes("approve")) return null;
  if (same(report.submitted_for_review_by?.id, userId)) {
    return "You submitted this report for review, so someone else has to approve it.";
  }
  const round = reviewRound(report.approval_steps);
  const pending = round?.pending ?? null;
  if (!pending) return null;
  const earlier = (report.approval_steps ?? []).some(
    (s) => s.status === "approved" && !s.closed && s.step_order < pending.step_order && same(s.acted_by?.id, userId),
  );
  if (earlier) return "You approved an earlier step of this review, so someone else has to approve this one.";
  return `The “${pending.name}” step is for the ${roleLabelFromServer(pending.role, pending.role_label)} role.`;
}

/**
 * The approve request. On a review chain it names the pending step it
 * approves (`step_id`), so an approval meant for a step another user just
 * approved answers 409 instead of approving the next one; remarks go as the
 * step's `reason`. The single review sends the action alone.
 */
export function approveInput(pending: CdaApprovalStep | null, remarks: string | null): CdaWorkflowInput {
  if (!pending) return { action: "approve" };
  return remarks ? { action: "approve", step_id: pending.id, reason: remarks } : { action: "approve", step_id: pending.id };
}

/**
 * Whether a refused step means the report moved on and is read again: a 409
 * (a stale step or status), or a 422 that names `step_id` (the page didn't
 * know the report had a review step).
 */
export function reloadsReport(err: unknown): boolean {
  const response = (err as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } } | null)?.response;
  if (response?.status === 409) return true;
  return response?.status === 422 && Object.hasOwn(response.data?.errors ?? {}, "step_id");
}

// ── Custom compliance requirements ──

export const REQUIREMENT_STATUS_META: Record<CdaRequirementStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "info" },
  filed: { label: "Filed", tone: "success" },
  not_applicable: { label: "Not applicable", tone: "neutral" },
};

export function requirementStatusMeta(status: string | null | undefined): { label: string; tone: Tone } {
  return status && Object.hasOwn(REQUIREMENT_STATUS_META, status)
    ? REQUIREMENT_STATUS_META[status as CdaRequirementStatus]
    : { label: UNKNOWN_LABEL, tone: "neutral" };
}

/** A calendar row that is a custom requirement, not a report. */
export function isRequirementRow(row: CdaCalendarRow): row is CdaRequirement {
  return row.kind === "requirement";
}

/** A React key unique across both kinds: a report and a requirement may share an id. */
export function calendarRowKey(row: CdaCalendarRow): string {
  return `${row.kind}-${row.id}`;
}

/** The requirement dialog's fields, as typed. */
export interface RequirementForm {
  title: string;
  description: string;
  default_due_on: string;
  extended_due_on: string;
  reference: string;
  status: CdaRequirementStatus;
  filed_on: string;
}

export function requirementForm(row: CdaRequirement | null): RequirementForm {
  return {
    title: row?.title ?? "",
    description: row?.description ?? "",
    default_due_on: row?.default_due_on ?? "",
    extended_due_on: row?.extended_due_on ?? "",
    reference: row?.reference ?? "",
    status: row?.status ?? "pending",
    filed_on: row?.filed_on ?? "",
  };
}

/** The labels of the required fields still blank: the title, the due date, and the filing date once filed. */
export function requirementMissing(form: RequirementForm): string[] {
  return [
    !form.title.trim() && "Title",
    !form.default_due_on && "Due date",
    form.status === "filed" && !form.filed_on && "Date filed",
  ].filter((v): v is string => typeof v === "string");
}

/**
 * What the dialog sends: text trimmed, a blank optional field as null, and a
 * filing date only on a filed item (the server refuses one otherwise).
 */
export function requirementPayload(form: RequirementForm): CdaRequirementInput {
  const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    title: form.title.trim(),
    description: blankToNull(form.description),
    default_due_on: form.default_due_on,
    extended_due_on: blankToNull(form.extended_due_on),
    reference: blankToNull(form.reference),
    status: form.status,
    filed_on: form.status === "filed" ? blankToNull(form.filed_on) : null,
  };
}
