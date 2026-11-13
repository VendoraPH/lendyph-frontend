import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  ApproveStepPayload,
  LoanApprovalState,
  SendBackStepPayload,
} from "@/types";
import type { PaginatedResponse } from "@/types/api";
import type { ForwardCandidates, SubmitLoanPayload } from "@/types/loan-approval";

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
   * Send a draft for approval (`PATCH /loans/{id}/submit`), which seeds the
   * chain. `forward_to_user_id` forwards its first approval step to one named
   * user; without it the step is its role's. A pick the server can't accept
   * is a 422 on `forward_to_user_id`, in words, and the loan stays a draft.
   */
  submit: async (loanId: number, payload?: SubmitLoanPayload): Promise<void> => {
    await api.patch(API_ENDPOINTS.LOANS.SUBMIT(loanId), payload ?? {});
  },

  /**
   * Who the step a submit or approve would make pending can be forwarded to,
   * as `{id, name}` only, by name. The server applies the same rule it checks
   * `forward_to_user_id` by.
   */
  forwardCandidates: (loanId: number) =>
    api.get<ForwardCandidates>(API_ENDPOINTS.LOAN_APPROVAL.FORWARD_CANDIDATES(loanId)),

  /**
   * How many loans wait on the signed-in user (`GET /loans?awaiting_me=1`):
   * loans for approval whose current step is theirs (forwarded to them, or
   * unassigned and their role's), and, for holders of `loans:release`,
   * approved loans whose Release step is theirs by the same rule. One integer
   * off `meta.total` of a `per_page: 1` read; null when the server sends none.
   */
  countAwaitingMe: async (): Promise<number | null> => {
    const res = await api.getRaw<PaginatedResponse<unknown>>(API_ENDPOINTS.LOANS.LIST, {
      params: { status: "for_review,approved", awaiting_me: 1, per_page: 1 },
    });
    const total = res?.meta?.total;
    return typeof total === "number" ? total : null;
  },

  /**
   * Sign off on the pending step and move the chain forward.
   *
   * The server advances the chain and, on the last `approve` step, moves the
   * loan itself to `approved` — so do NOT pair this with `PATCH /loans/{id}/approve`.
   * Returns nothing useful on purpose: re-read `state()` (and the loan) after,
   * rather than patching what is on screen from a response body.
   * `forward_to_user_id` forwards the step this makes pending, as on submit.
   *
   * The body names the step as `step_id` (the step ROW's id, the same as the
   * URL's): when it isn't the step waiting any more, a late click answers 409
   * with the server's sentence naming the step the loan is now at.
   */
  approve: async (
    loanId: number,
    stepId: number,
    payload?: ApproveStepPayload,
  ): Promise<void> => {
    await api.patch(API_ENDPOINTS.LOAN_APPROVAL.APPROVE_STEP(loanId, stepId), {
      ...payload,
      step_id: stepId,
    });
  },

  /**
   * Bounce the loan back to an earlier step for revision — the flowchart's
   * "Approved? = No" branch, which returns the loan rather than killing it.
   *
   * Opens a new round server-side and leaves `loans.status` at `for_review`.
   * `target_step_order` is a prior step's `index`, and `remarks` is required.
   * It names its step as `step_id` too, with the same 409 as `approve`.
   */
  sendBack: async (
    loanId: number,
    stepId: number,
    payload: SendBackStepPayload,
  ): Promise<void> => {
    await api.patch(API_ENDPOINTS.LOAN_APPROVAL.SEND_BACK_STEP(loanId, stepId), {
      ...payload,
      step_id: stepId,
    });
  },
};
