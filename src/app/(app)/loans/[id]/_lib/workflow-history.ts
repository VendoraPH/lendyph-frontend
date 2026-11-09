import type { Loan } from "@/types/loan";

/** `submitted_at` is a LoanResource field that `Loan` does not declare. */
export type WorkflowLoan = Pick<Loan, "status" | "created_at"> &
  Partial<
    Pick<
      Loan,
      | "approved_at"
      | "approved_by"
      | "approved_by_user"
      | "approval_remarks"
      | "rejected_at"
      | "rejected_by"
      | "rejection_remarks"
      | "released_at"
      | "released_by"
      | "released_by_user"
      | "updated_at"
    >
  > & { submitted_at?: string | null };

export type WorkflowEventKey = "created" | "submitted" | "approved" | "rejected" | "released" | "sent_back";

export interface WorkflowEvent {
  key: WorkflowEventKey;
  label: string;
  /** Null only for a submission the server has no date for. */
  date: string | null;
  detail?: string;
}

/**
 * Whether the loan went for approval: the server recorded when, or its status
 * is past that point. A voided loan may have been voided as a draft, so only the
 * record says so.
 */
function wasSubmitted(loan: WorkflowLoan): boolean {
  return !!loan.submitted_at || (loan.status !== "draft" && loan.status !== "void");
}

/**
 * The Workflow History, oldest first. A submission with no date sorts as if it
 * happened at creation, so it stays right after it; ties keep the order below.
 */
export function workflowEvents(loan: WorkflowLoan): WorkflowEvent[] {
  const events: WorkflowEvent[] = [
    { key: "created", label: "Application created", date: loan.created_at },
  ];

  if (wasSubmitted(loan)) {
    events.push({
      key: "submitted",
      label: "Submitted for approval",
      date: loan.submitted_at ?? null,
    });
  }

  if (loan.approved_at) {
    events.push({
      key: "approved",
      label: `Approved by ${loan.approved_by_user?.full_name ?? loan.approved_by_user?.name ?? loan.approved_by ?? "—"}`,
      date: loan.approved_at,
      detail: loan.approval_remarks ?? undefined,
    });
  }

  if (loan.rejected_at) {
    events.push({
      key: "rejected",
      label: `Rejected by ${loan.rejected_by ?? "—"}`,
      date: loan.rejected_at,
      detail: loan.rejection_remarks ?? undefined,
    });
  }

  if (loan.released_at) {
    events.push({
      key: "released",
      label: `Released by ${loan.released_by_user?.full_name ?? loan.released_by_user?.name ?? loan.released_by ?? "—"}`,
      date: loan.released_at,
    });
  }

  return sortWorkflowEvents(events, loan.created_at);
}

/** Oldest first; an event with no date sorts as if it happened at creation. Ties keep their order. */
export function sortWorkflowEvents(events: WorkflowEvent[], createdAt: string): WorkflowEvent[] {
  const time = (event: WorkflowEvent) => new Date(event.date ?? createdAt).getTime();
  return [...events].sort((a, b) => time(a) - time(b));
}
