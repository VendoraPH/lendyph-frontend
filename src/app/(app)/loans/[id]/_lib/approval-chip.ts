/**
 * The chip beside "Loan Approval Process" on the loan page. An imported loan
 * was approved in the cooperative's own records before it came in, so it has
 * no chain here: its chip reads "Imported" beside the "Imported from the
 * cooperative's records" note (finish run round 8), never "No steps found",
 * whether its chain read came back empty or failed. Every other state reads
 * as before. Pure, so it runs under `tsx --test`.
 */

export interface ApprovalChipState {
  loading: boolean;
  unavailable: boolean;
  allApproved: boolean;
  /** The pending step's index, or -1 when no step is pending. */
  currentStepIndex: number;
  stepCount: number;
  status: string;
  imported: boolean;
}

export function approvalChipLabel(state: ApprovalChipState): string {
  if (state.loading) return "Loading...";
  if (state.imported && state.stepCount === 0) return "Imported";
  if (state.unavailable) return "Unavailable";
  if (state.allApproved) return "Complete";
  if (state.currentStepIndex >= 0) return `Step ${state.currentStepIndex + 1} of ${state.stepCount}`;
  if (state.stepCount === 0) return state.status === "draft" ? "Not submitted" : "No steps found";
  return `${state.stepCount} steps`;
}
