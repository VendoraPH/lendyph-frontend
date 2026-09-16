import type { LoanStatus } from "./loan";

/**
 * The multi-step BOD approval chain that carries a loan from draft to release.
 *
 * SERVER-OWNED. These types describe `GET /loans/{loan}/approval-steps`, which
 * is the only source of truth for who has signed off. The chain used to live in
 * `localStorage` under `loan-approval-${loanId}`: approvals never crossed
 * devices, "clear site data" erased the signoff history, and nothing reached
 * the audit log. Nothing here is persisted client-side — if the read fails the
 * UI says so rather than reconstructing a chain, because a chain derived in the
 * browser is a claim about who approved a loan that no one can verify.
 */

/**
 * What acting on a step means.
 *
 * MUST stay in sync with the backend's validation on the approval-workflow
 * settings endpoint, which accepts `submit|approve|release` and 422s on
 * anything else. A fourth option, `confirmed`, was offered by the step editor:
 * it could never be saved, and the loan page rendered no action buttons for it,
 * so a chain containing one would have stalled with no way forward.
 */
export type ApprovalStepKind = "submit" | "approve" | "release";

export type ApprovalStepStatus = "waiting" | "pending" | "approved" | "sent_back";

export interface LoanApprovalStep {
  /**
   * The approval-step ROW id, and the only thing that addresses this step:
   * `/approval-steps/{id}/approve`. Not `step_id` — that is the chain-config
   * slug, which repeats on every round and on every loan, so it cannot
   * identify a row. Passing it to the act endpoints 404s.
   */
  id: number;
  /**
   * The server's `step_order`. This is the value `send-back` wants as
   * `target_step_order` — it is NOT guaranteed to be the row's position in
   * `current_steps`, so use it for payloads and array position for neighbour
   * lookups and "Step N of M" labels.
   */
  index: number;
  /** The chain-config slug (e.g. `"loan-processor"`). Display/diagnostics only. */
  step_id: number | string;
  name: string;
  role: string;
  kind: ApprovalStepKind;
  status: ApprovalStepStatus;
  remarks?: string | null;
  /** ISO timestamp. Set once the step has been acted on. */
  acted_at?: string | null;
  /** Display name of the acting user, resolved server-side. */
  acted_by?: string | null;
  acted_by_id?: number | null;
  /**
   * The server's verdict on whether the REQUESTING user may act on this step.
   * Authoritative: the client-side role check is advisory only, used to disable
   * a button early, never to decide whether an action is allowed.
   */
  can_act?: boolean;
}

/** A completed revision round, closed when an approver sends the loan back. */
export interface LoanApprovalRound {
  round: number;
  sent_back_by: string;
  sent_back_at: string;
  sent_back_remarks: string;
  steps: LoanApprovalStep[];
}

export interface LoanApprovalState {
  current_steps: LoanApprovalStep[];
  rounds: LoanApprovalRound[];
}

export interface ApproveStepPayload {
  remarks?: string;
}

export interface SendBackStepPayload {
  /** A prior step's `index` (the server's `step_order`), not an array position. */
  target_step_order: number;
  /** Required — an approver may not bounce a loan back without saying why. */
  remarks: string;
}

/**
 * Statuses for which the approval chain is over and must not be rendered.
 *
 * `void` belongs here alongside `rejected`: voiding is the escape hatch for a
 * draft that should never have existed, and the card used to keep showing the
 * orphaned chain — "Manager: pending" on a loan struck from the record.
 */
export const APPROVAL_CHAIN_HIDDEN_STATUSES: readonly LoanStatus[] = [
  "rejected",
  "void",
];

export function isApprovalChainHidden(status: string | undefined): boolean {
  return APPROVAL_CHAIN_HIDDEN_STATUSES.includes(status as LoanStatus);
}
