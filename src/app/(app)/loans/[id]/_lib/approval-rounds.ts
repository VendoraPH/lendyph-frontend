// Previous approval rounds as the loan page shows them, and their send-backs
// in the Workflow History. The step that closed a round can be any kind: since
// A1b, a release step is marked `sent_back` when an approved restructure is sent
// back before release. Everything shown is the server's chain.

import type { LoanApprovalRound } from "@/types/loan-approval";
import type { WorkflowEvent } from "./workflow-history";

export interface RevisionRoundBadge {
  key: number;
  text: string;
  outcome: "approved" | "sent_back";
}

export interface RevisionRoundView {
  heading: string;
  remarks: string | null;
  badges: RevisionRoundBadge[];
}

function sentBackBeforeRelease(round: LoanApprovalRound): boolean {
  return round.steps.some((s) => s.status === "sent_back" && s.kind === "release");
}

function actor(round: LoanApprovalRound): string {
  return typeof round.sent_back_by === "string" && round.sent_back_by.trim() !== "" ? round.sent_back_by : "—";
}

export function revisionRoundView(round: LoanApprovalRound): RevisionRoundView {
  const remarks = typeof round.sent_back_remarks === "string" && round.sent_back_remarks.trim() !== ""
    ? round.sent_back_remarks
    : null;
  return {
    heading: `${sentBackBeforeRelease(round) ? "Sent back before release" : "Sent back"} by ${actor(round)}`,
    remarks,
    badges: round.steps
      .filter((s) => s.status === "approved" || s.status === "sent_back")
      .map((s) => ({
        key: s.index,
        text: `${s.status === "approved" ? "✓" : "✗"} ${s.name}`,
        outcome: s.status === "approved" ? "approved" : "sent_back",
      })),
  };
}

/** One Workflow History event per round sent back, dated when it was. */
export function sentBackEvents(rounds: readonly LoanApprovalRound[]): WorkflowEvent[] {
  return rounds.map((round) => ({
    key: "sent_back",
    label: sentBackBeforeRelease(round)
      ? `Sent back for approval before release by ${actor(round)}`
      : `Sent back by ${actor(round)}`,
    date: round.sent_back_at ?? null,
    detail: revisionRoundView(round).remarks ?? undefined,
  }));
}
