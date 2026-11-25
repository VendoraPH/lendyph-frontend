import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APPROVAL_ACTIONS_ROW,
  approvalCardHref,
  approvalEditHref,
  asksApprovalEdit,
  offersApprovalEdit,
  readApprovalEditState,
} from "./approval-edit";
import type { LoanApprovalEditState } from "@/types/loan-approval";

const AT_CHAIR = { id: 41, kind: "approve" as const };
const YES: LoanApprovalEditState = { can_edit: true, reason: null, step: { id: 41, name: "BOD Chairwoman" }, version: "a".repeat(64) };

test("only the holder of loans:edit_in_approval asks, while the loan waits at an approve step", () => {
  assert.equal(asksApprovalEdit({ canEditInApproval: true, loanStatus: "for_review", currentStep: AT_CHAIR }), true);
  assert.equal(asksApprovalEdit({ canEditInApproval: false, loanStatus: "for_review", currentStep: AT_CHAIR }), false);
  for (const status of ["draft", "approved", "released", "rejected", "void"]) {
    assert.equal(asksApprovalEdit({ canEditInApproval: true, loanStatus: status, currentStep: AT_CHAIR }), false, status);
  }
  for (const kind of ["submit", "release"] as const) {
    assert.equal(asksApprovalEdit({ canEditInApproval: true, loanStatus: "for_review", currentStep: { kind } }), false, kind);
  }
  assert.equal(asksApprovalEdit({ canEditInApproval: true, loanStatus: "for_review", currentStep: null }), false);
});

test("Edit Loan shows only on the server's yes, for the step on screen", () => {
  const base = { canEditInApproval: true, loanStatus: "for_review", currentStep: AT_CHAIR };
  assert.equal(offersApprovalEdit({ ...base, state: YES }), true);
  // Not until the server answers, and never on its no.
  assert.equal(offersApprovalEdit({ ...base, state: null }), false);
  assert.equal(
    offersApprovalEdit({ ...base, state: { ...YES, can_edit: false, version: null, reason: "Not your step." } }),
    false,
  );
  // A yes for another step (the chain moved on) is no yes for this one.
  assert.equal(offersApprovalEdit({ ...base, state: { ...YES, step: { id: 40, name: "Manager" } } }), false);
  // Without the permission, a yes left over from another session doesn't count.
  assert.equal(offersApprovalEdit({ ...base, canEditInApproval: false, state: YES }), false);
  assert.equal(offersApprovalEdit({ ...base, loanStatus: "approved", state: YES }), false);
});

test("the server's answer is read strictly: a malformed one is no edit", () => {
  assert.deepEqual(readApprovalEditState(YES), YES);
  assert.equal(readApprovalEditState(null), null);
  assert.equal(readApprovalEditState("yes"), null);
  assert.equal(readApprovalEditState({ can_edit: "true" }), null);
  // A yes with no version or no step can't be saved, so it reads as no.
  assert.equal(readApprovalEditState({ ...YES, version: null })?.can_edit, false);
  assert.equal(readApprovalEditState({ ...YES, version: "" })?.can_edit, false);
  assert.equal(readApprovalEditState({ ...YES, step: null })?.can_edit, false);
  assert.deepEqual(
    readApprovalEditState({ can_edit: false, reason: "This loan isn't waiting for approval, so it can't be edited here.", step: null, version: null }),
    { can_edit: false, reason: "This loan isn't waiting for approval, so it can't be edited here.", step: null, version: null },
  );
});

test("the edit opens the loan form in approval mode and returns to the approval card", () => {
  assert.equal(approvalEditHref(12), "/loans/new?edit=12&approval=1");
  assert.equal(approvalCardHref(12), "/loans/12#approval");
});

// At 1024x640 the approve step's four actions (Edit Loan, the send-back
// target, Send Back for Revision and Approve & Forward) don't fit one row in
// the card: the row wraps instead of pushing Edit Loan out of the card. A
// stacked column below sm, right-aligned buttons from sm, as before; at 1440
// they still fit one row.
test("the approval card's action rows wrap from sm up, so no button is pushed out of the card", () => {
  const classes = APPROVAL_ACTIONS_ROW.split(" ");
  for (const kept of ["flex", "flex-col-reverse", "sm:flex-row", "sm:justify-end", "gap-2"]) {
    assert.ok(classes.includes(kept), kept);
  }
  assert.ok(classes.includes("sm:flex-wrap"));

  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.equal(page.split("className={APPROVAL_ACTIONS_ROW}").length - 1, 2, "both approval card rows use it");
  assert.doesNotMatch(page, /<div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">/);
});

// The approve step's buttons share their row with the 32 px "Send back to"
// select, so they are 32 px too (the field-height rule: the Button's default
// h-8, never its 28 px size="sm"). The other rows' buttons keep their size
// (finish run round 4).
test("the approve step's buttons are 32 px like the send-back select beside them; other rows keep theirs", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  const block = (from: string, to: string) => {
    const start = page.indexOf(from);
    const end = page.indexOf(to, start);
    assert.ok(start > -1 && end > start, from);
    return page.slice(start, end);
  };
  const submit = block('{currentStep.kind === "submit" && (', '{currentStep.kind === "approve" && (');
  const approve = block('{currentStep.kind === "approve" && (', '{currentStep.kind === "release" && (');
  const release = block('{currentStep.kind === "release" && (', "Release Loan");

  assert.match(approve, /<SelectTrigger\s+id="send-back-target"/);
  for (const label of ["Edit Loan", "Send Back for Revision", "Approve & Forward"]) {
    assert.ok(approve.includes(label), label);
  }
  assert.equal(approve.match(/<Button\b/g)?.length, 3);
  assert.doesNotMatch(approve, /size="sm"|\bh-7\b/);

  // Unchanged: the submit step's three buttons and the Release step's one.
  assert.equal(submit.match(/<Button\b/g)?.length, 3);
  assert.equal(submit.match(/size="sm"/g)?.length, 3);
  assert.equal(release.match(/size="sm"/g)?.length, 1);
});
