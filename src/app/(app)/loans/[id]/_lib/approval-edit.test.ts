import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
