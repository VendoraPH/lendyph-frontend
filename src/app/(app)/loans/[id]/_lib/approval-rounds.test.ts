/**
 * Previous approval rounds, and the Workflow History's send-backs, when the
 * step that sent the loan back is any kind: submit, approve, or (since A1b) a
 * release step on an approved restructure sent back before release.
 *
 * WHAT THIS PROVES: the round's heading says who sent it back and, for a
 * release step, that it was before release; a missing actor reads as a dash;
 * the badges list the acted steps, the release step included; and each round
 * adds one Workflow History event, dated when it was sent back.
 * WHAT IT DOES NOT PROVE: the chain itself (server-owned).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LoanApprovalRound, LoanApprovalStep } from "@/types/loan-approval";
import { revisionRoundView, sentBackEvents } from "./approval-rounds";

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

test("each round adds one Workflow History send-back, dated when it happened", () => {
  assert.deepEqual(sentBackEvents([RELEASE_SENT_BACK]), [
    {
      key: "sent_back",
      label: "Sent back for approval before release by Gina Bookkeeper",
      date: "2026-11-09T03:00:00Z",
      detail: "To Loan Processor: source paid down after approval",
    },
  ]);
  assert.equal(
    sentBackEvents([{ ...RELEASE_SENT_BACK, steps: [step(1, "approve", "sent_back", "Manager")] }])[0].label,
    "Sent back by Gina Bookkeeper",
  );
  assert.deepEqual(sentBackEvents([]), []);
});
