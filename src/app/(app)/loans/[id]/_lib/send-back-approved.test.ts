/**
 * "Send back for approval" on an approved, unreleased restructure.
 *
 * WHAT THIS PROVES: the action shows only when the server's
 * `can_send_back_approved` is true (the browser never decides it); the reason
 * is required, trimmed and at most 1000 characters, as the API's rule; and a
 * refusal that means the loan moved on (409, or a 422 on `status`) reloads the
 * loan, while a refused reason keeps the dialog open.
 * WHAT IT DOES NOT PROVE: the server's rules (backend tests), or the dialog
 * itself (no DOM here; the page wiring is pinned in its source).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SEND_BACK_REASON_MAX,
  canSendBackApproved,
  sendBackApprovedPayload,
  sendBackFailureAction,
  sendBackReasonError,
} from "./send-back-approved";

const httpError = (status: number, errors?: Record<string, string[]>) => ({
  response: { status, data: { message: "refused", errors } },
});

test("only the server's flag shows the action", () => {
  assert.equal(canSendBackApproved({ can_send_back_approved: true }), true);
  assert.equal(canSendBackApproved({ can_send_back_approved: false }), false);
  assert.equal(canSendBackApproved({}), false);
  // An approved restructure without the flag (an older API, or no loans:release) still hides it.
  // @ts-expect-error: only the server's flag is read, so the loan's status and kind aren't accepted
  assert.equal(canSendBackApproved({ status: "approved", is_restructure: true }), false);
});

test("the reason is required, and at most 1000 characters", () => {
  assert.equal(sendBackReasonError(""), "Enter the reason for sending this restructure back for approval.");
  assert.equal(sendBackReasonError("   "), "Enter the reason for sending this restructure back for approval.");
  assert.equal(sendBackReasonError("x".repeat(SEND_BACK_REASON_MAX)), null);
  assert.equal(sendBackReasonError("x".repeat(SEND_BACK_REASON_MAX + 1)), "The reason can be at most 1000 characters.");
  assert.equal(SEND_BACK_REASON_MAX, 1000);
});

test("the request sends the reason trimmed", () => {
  assert.deepEqual(sendBackApprovedPayload("  Source paid down after approval  "), {
    reason: "Source paid down after approval",
  });
});

test("a refusal that means the loan moved on reloads it; a refused reason stays", () => {
  assert.equal(sendBackFailureAction(httpError(409)), "reload");
  assert.equal(sendBackFailureAction(httpError(422, { status: ["already released"] })), "reload");
  assert.equal(sendBackFailureAction(httpError(422, { reason: ["too long"] })), "stay");
  assert.equal(sendBackFailureAction(httpError(500)), "stay");
  assert.equal(sendBackFailureAction(new Error("network")), "stay");
});

test("the loan page wires the action to the server's flag and the server's words", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.ok(page.includes("canSendBackApproved(loan) && ("));
  assert.ok(page.includes("loanService.sendBackApproved(loan.id, sendBackApprovedPayload(sendBackReason))"));
  assert.ok(page.includes('notifyError(err, "We couldn\'t send this restructure back for approval. Please try again.")'));
  assert.ok(page.includes("Send back for approval"));
});
