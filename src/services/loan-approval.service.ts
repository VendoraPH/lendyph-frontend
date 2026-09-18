import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  ApproveStepPayload,
  LoanApprovalState,
  SendBackStepPayload,
} from "@/types";

/**
 * The loan's multi-step approval chain, server-side.
 *
 * Replaces the `loan-approval-${loanId}` localStorage record. Every read and
 * every signoff goes through here, so approvals cross devices, survive a
 * cleared browser, and land in the audit log.
 *
 * Deliberately write-poor: there is no "save the whole chain" call. The client
 * can act on the step it has been offered and nothing else — letting it POST a
 * history would let anyone fabricate a board's signoff.
 *
 * Both act endpoints are gated server-side on the step's `role` (admin and
 * super_admin excepted). `can_act` on each step is the same rule evaluated for
 * the requesting user; treat it as what to render, never as what is permitted.
 */
export const loanApprovalService = {
  /**
   * The chain as it stands: the live steps plus every closed revision round.
   *
   * 404s until the backend ships, and for any loan whose chain was never
   * seeded — callers must render that as "unavailable", not as an empty chain
   * or a client-side reconstruction.
   */
  state: (loanId: number) =>
    api.get<LoanApprovalState>(API_ENDPOINTS.LOAN_APPROVAL.STEPS(loanId)),

  /**
   * Sign off on the pending step and move the chain forward.
   *
   * The server advances the chain and, on the last `approve` step, moves the
   * loan itself to `approved` — so do NOT pair this with `loanService.approve`.
   * Returns nothing useful on purpose: re-read `state()` (and the loan) after,
   * rather than patching what is on screen from a response body.
   */
  approve: async (
    loanId: number,
    stepId: number | string,
    payload?: ApproveStepPayload,
  ): Promise<void> => {
    await api.patch(
      API_ENDPOINTS.LOAN_APPROVAL.APPROVE_STEP(loanId, stepId),
      payload ?? {},
    );
  },

  /**
   * Bounce the loan back to an earlier step for revision — the flowchart's
   * "Approved? = No" branch, which returns the loan rather than killing it.
   *
   * Opens a new round server-side and leaves `loans.status` at `for_review`.
   * `target_step_order` is a prior step's `index`, and `remarks` is required.
   */
  sendBack: async (
    loanId: number,
    stepId: number | string,
    payload: SendBackStepPayload,
  ): Promise<void> => {
    await api.patch(
      API_ENDPOINTS.LOAN_APPROVAL.SEND_BACK_STEP(loanId, stepId),
      payload,
    );
  },
};
