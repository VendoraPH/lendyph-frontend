// Previous approval rounds as the loan page shows them, and every round's
// sign-offs, send-back and re-submission in the Workflow History. The step that closed a round can be any kind: since
// A1b, a release step is marked `sent_back` when an approved restructure is sent
// back before release. Everything shown is the server's chain.

import type { LoanApprovalRound, LoanApprovalStep } from "@/types/loan-approval";
import { sortWorkflowEvents, type WorkflowEvent } from "./workflow-history";

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

function by(name: string | null | undefined): string {
  return typeof name === "string" && name.trim() !== "" ? name : "—";
}

/** The events one round's acted steps add, in the chain's order. */
function roundEvents(steps: readonly LoanApprovalStep[], first: boolean, round: LoanApprovalRound | null): WorkflowEvent[] {
  return steps.flatMap((s): WorkflowEvent[] => {
    const detail = s.remarks && s.remarks.trim() !== "" ? s.remarks : undefined;
    if (s.status === "sent_back") {
      const actorName = by(s.acted_by ?? round?.sent_back_by);
      return [
        {
          key: "sent_back",
          label:
            s.kind === "release"
              ? `Sent back for approval before release by ${actorName}`
              : `Sent back by ${actorName}`,
          date: s.acted_at ?? round?.sent_back_at ?? null,
          // The round's own summary names where it went back to.
          detail: (round ? revisionRoundView(round).remarks : null) ?? detail,
        },
      ];
    }
    if (s.status !== "approved" || !s.acted_at) return [];
    if (s.kind === "submit") {
      return [
        {
          key: "submitted",
          label: `${first ? "Submitted" : "Re-submitted"} for approval by ${by(s.acted_by)}`,
          date: s.acted_at,
          detail,
        },
      ];
    }
    // A release step's sign-off is the loan's own Released line.
    if (s.kind === "release") return [];
    return [{ key: "approved", label: `Approved by ${by(s.acted_by)} (${s.name})`, date: s.acted_at, detail }];
  });
}

/**
 * Every round's sign-offs, send-back and re-submission, oldest round first,
 * then the round in progress: the Workflow History's chain lines.
 */
export function chainEvents(
  rounds: readonly LoanApprovalRound[],
  currentSteps: readonly LoanApprovalStep[],
): WorkflowEvent[] {
  const previous = [...rounds].sort((a, b) => a.round - b.round);
  return [
    ...previous.flatMap((round, i) => roundEvents(round.steps, i === 0, round)),
    ...roundEvents(currentSteps, previous.length === 0, null),
  ];
}

/**
 * The loan's own milestones with the chain's lines. The chain's submissions
 * and approvals replace the loan's single Submitted and Approved lines (the
 * loan keeps only its latest approval); with no chain lines, the loan's stand.
 */
export function withChainEvents(
  base: readonly WorkflowEvent[],
  chain: readonly WorkflowEvent[],
  createdAt: string,
): WorkflowEvent[] {
  if (chain.length === 0) return [...base];
  const chainHas = (key: WorkflowEvent["key"]) => chain.some((e) => e.key === key);
  const kept = base.filter(
    (e) => !(e.key === "submitted" && chainHas("submitted")) && !(e.key === "approved" && chainHas("approved")),
  );
  return sortWorkflowEvents([...kept, ...chain], createdAt);
}
