// Types for the multi-step approval chain on the loan detail page.
// The chain is loaded from approvalWorkflowService and snapshotted per loan.

export type ChainStepKind = "submit" | "approve" | "release" | "confirmed";

export type ApprovalStepStatus =
  | "waiting"
  | "pending"
  | "approved"
  | "sent_back";

export interface ApprovalStep {
  index: number;
  name: string;
  role: string;
  kind: ChainStepKind;
  status: ApprovalStepStatus;
  remarks?: string;
  acted_at?: string; // ISO
  acted_by?: string;
}

// A snapshot of a previous revision round, created whenever an approver sends
// the loan back to the Loan Processor.
export interface RevisionRound {
  round: number;
  steps: ApprovalStep[];
  sent_back_by: string;
  sent_back_at: string;
  sent_back_remarks: string;
}

export interface ApprovalState {
  current_steps: ApprovalStep[];
  rounds: RevisionRound[];
}
