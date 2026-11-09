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
  const events = [
    ...previous.flatMap((round, i) => roundEvents(round.steps, i === 0, round)),
    ...roundEvents(currentSteps, previous.length === 0, null),
  ];
  // A step with no date on record (an older round's send-back) keeps its place
  // in the chain: it sorts at the date of the event before it, never at the
  // top, and still shows no date.
  let lastDate: string | null = null;
  return events.map((event) => {
    if (event.date !== null) {
      lastDate = event.date;
      return event;
    }
    return lastDate === null ? event : { ...event, sortDate: lastDate };
  });
}

/** One sign-off or send-back under "Previous Approval Remarks". */
export interface ApprovalRemark {
  /** Round and step order: unique across rounds. */
  key: string;
  /** 1 for the first round; the round in progress is the last. */
  round: number;
  name: string;
  outcome: "approved" | "sent_back";
  actedBy: string | null;
  actedAt: string | null;
  remarks: string | null;
}

function text(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** One round's acted steps, the last acted first. */
function roundRemarks(
  steps: readonly LoanApprovalStep[],
  round: number,
  closed: LoanApprovalRound | null,
): ApprovalRemark[] {
  return steps
    .filter((s) => s.status === "approved" || s.status === "sent_back")
    .sort((a, b) => b.index - a.index)
    .map((s): ApprovalRemark => {
      const sentBack = s.status === "sent_back";
      return {
        key: `${round}-${s.index}`,
        round,
        name: s.name,
        outcome: sentBack ? "sent_back" : "approved",
        actedBy: text(s.acted_by) ?? (sentBack ? text(closed?.sent_back_by) : null),
        actedAt: text(s.acted_at) ?? (sentBack ? text(closed?.sent_back_at) : null),
        remarks: text(s.remarks) ?? (sentBack ? text(closed?.sent_back_remarks) : null),
      };
    })
    .filter((r) => r.actedAt !== null);
}

/**
 * "Previous Approval Remarks": every round's sign-offs and send-backs, newest
 * first (the round in progress, then each earlier round, the last step acted
 * first). A step with no date on record is left out, as before; a send-back
 * takes its round's date, actor and reason when the step has none.
 */
export function approvalRemarksHistory(
  rounds: readonly LoanApprovalRound[],
  currentSteps: readonly LoanApprovalStep[],
): ApprovalRemark[] {
  const previous = [...rounds].sort((a, b) => b.round - a.round);
  const currentRound = previous.length > 0 ? previous[0].round + 1 : 1;
  return [
    ...roundRemarks(currentSteps, currentRound, null),
    ...previous.flatMap((round) => roundRemarks(round.steps, round.round, round)),
  ];
}

/**
 * "The loan is ready for release." only while the loan is approved and not yet
 * released: once released (or restructured, or anything after), every step
 * reads signed off but there is nothing left to release.
 */
export function readyForRelease(status: string, allStepsApproved: boolean): boolean {
  return allStepsApproved && status === "approved";
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
