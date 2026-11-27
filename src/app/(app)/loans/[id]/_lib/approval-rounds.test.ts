/**
 * Previous approval rounds, and the Workflow History's send-backs, when the
 * step that sent the loan back is any kind: submit, approve, or (since A1b) a
 * release step on an approved restructure sent back before release.
 *
 * WHAT THIS PROVES: the round's heading says who sent it back and, for a
 * release step, that it was before release; a missing actor reads as a dash;
 * the badges list the acted steps, the release step included; and the
 * Workflow History lists every round's sign-offs, send-back and
 * re-submission in order.
 * WHAT IT DOES NOT PROVE: the chain itself (server-owned).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LoanApprovalRound, LoanApprovalStep } from "@/types/loan-approval";
import {
  approvalRemarksHistory,
  approvalStepState,
  chainEvents,
  readyForRelease,
  revisionRoundView,
  withChainEvents,
} from "./approval-rounds";

function step(index: number, kind: LoanApprovalStep["kind"], status: LoanApprovalStep["status"], name: string): LoanApprovalStep {
  return { id: index + 1, index, step_id: name, name, role: "r", kind, status };
}

const RELEASE_SENT_BACK: LoanApprovalRound = {
  round: 1,
  sent_back_by: "Gina Bookkeeper",
  sent_back_at: "2026-11-09T03:00:00Z",
  sent_back_remarks: "To Loan Processor: source paid down after approval",
  steps: [
    step(0, "submit", "approved", "Loan Processor"),
    step(1, "approve", "approved", "Manager"),
    step(2, "release", "sent_back", "Cashier"),
  ],
};

test("a release step sent back reads as sent back before release, with every acted step", () => {
  const view = revisionRoundView(RELEASE_SENT_BACK);
  assert.equal(view.heading, "Sent back before release by Gina Bookkeeper");
  assert.equal(view.remarks, "To Loan Processor: source paid down after approval");
  assert.deepEqual(view.badges, [
    { key: 0, text: "✓ Loan Processor", outcome: "approved" },
    { key: 1, text: "✓ Manager", outcome: "approved" },
    { key: 2, text: "✗ Cashier", outcome: "sent_back" },
  ]);
});

test("an approver's send-back keeps its wording", () => {
  const view = revisionRoundView({
    ...RELEASE_SENT_BACK,
    steps: [step(0, "submit", "approved", "Loan Processor"), step(1, "approve", "sent_back", "Manager"), step(2, "release", "waiting", "Cashier")],
  });
  assert.equal(view.heading, "Sent back by Gina Bookkeeper");
  assert.deepEqual(view.badges.map((b) => b.text), ["✓ Loan Processor", "✗ Manager"]);
});

test("a round with no actor or remarks on record reads as a dash, never 'null'", () => {
  const view = revisionRoundView({
    ...RELEASE_SENT_BACK,
    sent_back_by: null as unknown as string,
    sent_back_remarks: null as unknown as string,
  });
  assert.equal(view.heading, "Sent back before release by —");
  assert.equal(view.remarks, null);
});

test("the Workflow History lists every round in order: approvals, the send-back, the re-submission, the re-approvals", () => {
  const round1: LoanApprovalRound = {
    ...RELEASE_SENT_BACK,
    steps: [
      { ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-01T01:00:00Z", acted_by: "Lea Processor" },
      { ...step(1, "approve", "approved", "Manager"), acted_at: "2026-11-02T01:00:00Z", acted_by: "Mona Manager", remarks: "ok" },
      { ...step(2, "release", "sent_back", "Cashier"), acted_at: "2026-11-09T03:00:00Z", acted_by: "Gina Bookkeeper", remarks: "source paid down after approval" },
    ],
  };
  const current = [
    { ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-09T05:00:00Z", acted_by: "Lea Processor" },
    { ...step(1, "approve", "approved", "Manager"), acted_at: "2026-11-09T06:00:00Z", acted_by: "Mona Manager" },
    step(2, "release", "pending", "Cashier"),
  ];
  const events = chainEvents([round1], current);
  assert.deepEqual(
    events.map((e) => [e.key, e.label, e.date]),
    [
      ["submitted", "Submitted for approval by Lea Processor", "2026-11-01T01:00:00Z"],
      ["approved", "Approved by Mona Manager (Manager)", "2026-11-02T01:00:00Z"],
      ["sent_back", "Sent back for approval before release by Gina Bookkeeper", "2026-11-09T03:00:00Z"],
      ["submitted", "Re-submitted for approval by Lea Processor", "2026-11-09T05:00:00Z"],
      ["approved", "Approved by Mona Manager (Manager)", "2026-11-09T06:00:00Z"],
    ],
  );
  assert.equal(events[1].detail, "ok");
  assert.equal(events[2].detail, "To Loan Processor: source paid down after approval");
});

test("the chain's events replace the loan's single submitted and approved lines, and keep the rest", () => {
  const base = [
    { key: "created" as const, label: "Application created", date: "2026-10-31T00:00:00Z" },
    { key: "submitted" as const, label: "Submitted for approval", date: "2026-11-01T01:00:00Z" },
    { key: "approved" as const, label: "Approved by Mona Manager", date: "2026-11-09T06:00:00Z" },
  ];
  const chain = [
    { key: "submitted" as const, label: "Submitted for approval by Lea", date: "2026-11-01T01:00:00Z" },
    { key: "approved" as const, label: "Approved by Mona (Manager)", date: "2026-11-02T01:00:00Z" },
  ];
  assert.deepEqual(
    withChainEvents(base, chain, "2026-10-31T00:00:00Z").map((e) => e.label),
    ["Application created", "Submitted for approval by Lea", "Approved by Mona (Manager)"],
  );
});

test("with no chain on record the loan's own lines stand", () => {
  const base = [{ key: "approved" as const, label: "Approved by Mona Manager", date: "2026-11-09T06:00:00Z" }];
  assert.deepEqual(withChainEvents(base, [], "2026-10-31T00:00:00Z"), base);
  assert.deepEqual(chainEvents([], [step(0, "submit", "pending", "Loan Processor")]), []);
});

test("an acted step with no actor on record reads a dash", () => {
  const events = chainEvents([], [{ ...step(1, "approve", "approved", "Manager"), acted_at: "2026-11-02T01:00:00Z" }]);
  assert.equal(events[0].label, "Approved by — (Manager)");
});

test("an undated send-back stays after its round's sign-offs, never at the top", () => {
  const round1: LoanApprovalRound = {
    ...RELEASE_SENT_BACK,
    sent_back_at: null as unknown as string,
    steps: [
      { ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-01T01:00:00Z", acted_by: "Lea" },
      { ...step(1, "approve", "approved", "Manager"), acted_at: "2026-11-02T01:00:00Z", acted_by: "Mona" },
      { ...step(2, "release", "sent_back", "Cashier"), acted_by: "Gina" },
    ],
  };
  const current = [{ ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-09T05:00:00Z", acted_by: "Lea" }];
  const base = [{ key: "created" as const, label: "Application created", date: "2026-10-31T00:00:00Z" }];
  const events = withChainEvents(base, chainEvents([round1], current), "2026-10-31T00:00:00Z");
  assert.deepEqual(
    events.map((e) => [e.key, e.date]),
    [
      ["created", "2026-10-31T00:00:00Z"],
      ["submitted", "2026-11-01T01:00:00Z"],
      ["approved", "2026-11-02T01:00:00Z"],
      // No date on record: shown as a dash, in its place in the chain.
      ["sent_back", null],
      ["submitted", "2026-11-09T05:00:00Z"],
    ],
  );
});

test("Previous Approval Remarks lists every round's sign-offs, newest first", () => {
  const round1: LoanApprovalRound = {
    ...RELEASE_SENT_BACK,
    steps: [
      { ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-01T01:00:00Z", acted_by: "Lea" },
      { ...step(1, "approve", "approved", "Manager"), acted_at: "2026-11-02T01:00:00Z", acted_by: "Mona", remarks: "ok" },
      { ...step(2, "release", "sent_back", "Cashier"), acted_by: "Gina" },
    ],
  };
  const current = [
    { ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-09T05:00:00Z", acted_by: "Lea" },
    { ...step(1, "approve", "approved", "Manager"), acted_at: "2026-11-09T06:00:00Z", acted_by: "Mona", remarks: "fine now" },
    step(2, "release", "pending", "Cashier"),
  ];
  const history = approvalRemarksHistory([round1], current);
  assert.deepEqual(
    history.map((r) => [r.key, r.round, r.name, r.outcome, r.actedBy, r.actedAt, r.remarks]),
    [
      ["2-1", 2, "Manager", "approved", "Mona", "2026-11-09T06:00:00Z", "fine now"],
      ["2-0", 2, "Loan Processor", "approved", "Lea", "2026-11-09T05:00:00Z", null],
      // The send-back's own date and reason come from its round when the step has none.
      ["1-2", 1, "Cashier", "sent_back", "Gina", "2026-11-09T03:00:00Z", "To Loan Processor: source paid down after approval"],
      ["1-1", 1, "Manager", "approved", "Mona", "2026-11-02T01:00:00Z", "ok"],
      ["1-0", 1, "Loan Processor", "approved", "Lea", "2026-11-01T01:00:00Z", null],
    ],
  );
  // One round only: the same list as before, the current round's acted steps.
  assert.deepEqual(
    approvalRemarksHistory([], current).map((r) => r.key),
    ["1-1", "1-0"],
  );
  assert.deepEqual(approvalRemarksHistory([], [step(0, "submit", "pending", "Loan Processor")]), []);
});

test("ready for release only on an approved loan whose chain is signed off", () => {
  assert.equal(readyForRelease("approved", true), true);
  assert.equal(readyForRelease("approved", false), false);
  assert.equal(readyForRelease("released", true), false);
  assert.equal(readyForRelease("ongoing", true), false);
  assert.equal(readyForRelease("restructured", true), false);
});

test("a voided loan's cancelled steps read as one Cancelled line, never as waiting", () => {
  const current: LoanApprovalStep[] = [
    { ...step(0, "submit", "approved", "Loan Processor"), acted_at: "2026-11-09T05:00:00Z", acted_by: "Lea" },
    { ...step(1, "approve", "cancelled", "Manager"), acted_at: "2026-11-09T07:00:00Z", acted_by: "Vic Voider" },
    { ...step(2, "release", "cancelled", "Cashier"), acted_at: "2026-11-09T07:00:00Z", acted_by: "Vic Voider" },
  ];
  assert.deepEqual(
    chainEvents([], current).map((e) => [e.key, e.label, e.date]),
    [
      ["submitted", "Submitted for approval by Lea", "2026-11-09T05:00:00Z"],
      ["cancelled", "Approval cancelled by Vic Voider (Manager, Cashier)", "2026-11-09T07:00:00Z"],
    ],
  );
  // Cancelled steps are not sign-offs or send-backs.
  assert.deepEqual(approvalRemarksHistory([], current).map((r) => r.name), ["Loan Processor"]);
});

test("the approval tracker reads each step's state, cancelled included", () => {
  assert.equal(approvalStepState("pending"), "current");
  assert.equal(approvalStepState("approved"), "done");
  assert.equal(approvalStepState("sent_back"), "sent_back");
  assert.equal(approvalStepState("cancelled"), "cancelled");
  assert.equal(approvalStepState("waiting"), "waiting");
});
