/**
 * The void reason and the adjustment remarks, asked in app dialogs.
 *
 * They were the browser's own prompt boxes: unstyled, blockable, and Cancel
 * on the approval's box still approved the adjustment.
 *
 * WHAT THIS PROVES: the void reason is required, as the server requires it;
 * an approval's remarks are optional, as the server takes them; a rejection
 * keeps the remark the old box asked for; each dialog says what it does in
 * words, naming the payment by its receipt and amount in pesos; the loan page
 * has no browser prompt left and opens these dialogs instead.
 * WHAT IT DOES NOT PROVE: the requests, which the page sends.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOAN_DECISION_NOTE_MAX, adjustmentDecisionDialog, voidPaymentDialog } from "./decision-dialogs";

const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

test("voiding a payment needs a reason, as the server requires", () => {
  const dialog = voidPaymentDialog({ id: 12, receipt_number: "RCP-000012", amount_paid: "1500" });
  assert.equal(dialog.title, "Void this payment?");
  assert.equal(dialog.reasonRequired, true);
  assert.equal(dialog.reasonLabel, "Reason");
  assert.equal(dialog.confirmLabel, "Void Payment");
  assert.equal(dialog.destructive, true);
  assert.match(dialog.description, /^Receipt RCP-000012 \(₱1,500\.00\) will be voided\./);
  assert.match(dialog.description, /can't be undone/);
});

test("a payment the page hasn't loaded is named in words, never a dash or a blank", () => {
  const dialog = voidPaymentDialog(undefined);
  assert.equal(dialog.reasonRequired, true);
  assert.match(dialog.description, /^This payment will be voided\./);
  assert.doesNotMatch(dialog.description, /undefined|null|NaN|—/);
});

test("approving takes optional remarks, as the server does", () => {
  const dialog = adjustmentDecisionDialog("approve", "Balance Adjustment");
  assert.equal(dialog.title, "Approve this balance adjustment?");
  assert.equal(dialog.reasonRequired, false);
  assert.equal(dialog.reasonLabel, "Remarks");
  assert.equal(dialog.confirmLabel, "Approve");
  assert.equal(dialog.destructive, false);
});

test("rejecting keeps the remark the old box asked for", () => {
  const dialog = adjustmentDecisionDialog("reject", "Penalty Waiver");
  assert.equal(dialog.title, "Reject this penalty waiver?");
  assert.equal(dialog.reasonRequired, true);
  assert.equal(dialog.reasonLabel, "Remarks");
  assert.equal(dialog.confirmLabel, "Reject");
  assert.equal(dialog.destructive, true);
});

test("an adjustment type with no label reads 'adjustment', never its key", () => {
  assert.equal(adjustmentDecisionDialog("approve", undefined).title, "Approve this adjustment?");
});

test("a reason or remark may be as long as the server keeps (max:1000)", () => {
  assert.equal(LOAN_DECISION_NOTE_MAX, 1000);
});

test("the loan page asks in app dialogs, never the browser's prompt box", () => {
  assert.doesNotMatch(page, /\bprompt\(/);
  // Void, approve or reject, and (round 6) cancelling an approved adjustment.
  assert.equal(page.match(/<ReasonDialog\b/g)?.length, 3);
  assert.match(page, /\{\.\.\.voidPaymentDialog\(/);
  assert.match(page, /\{\.\.\.adjustmentDecisionDialog\(/);
  assert.equal(page.match(/maxLength=\{LOAN_DECISION_NOTE_MAX\}/g)?.length, 2);
});

test("Void, Approve and Reject open their dialog, and Apply still applies at once", () => {
  assert.match(page, /onVoid=\{handleVoidRepayment\}/);
  assert.match(page, /const handleVoidRepayment = \(repaymentId: number\) => \{\s*setVoidTarget\(repaymentId\);\s*setVoidOpen\(true\);/);
  assert.match(page, /onClick=\{\(\) => askAdjustmentDecision\(\{ adjustment: adj, action: "approve" \}\)\}/);
  assert.match(page, /onClick=\{\(\) => askAdjustmentDecision\(\{ adjustment: adj, action: "reject" \}\)\}/);
  assert.match(page, /onClick=\{\(\) => handleApplyAdjustment\(adj\.id\)\}/);
});

test("the void reason goes to the server as typed, and a refusal stays in the dialog", () => {
  assert.match(page, /await repaymentService\.void\(repaymentId, \{ void_reason: reason \}\);/);
  // onConfirm hands back the request's promise, so ReasonDialog shows a refusal.
  assert.match(page, /onConfirm=\{\(reason\) => \(voidTarget === null \? Promise\.resolve\(\) : voidPayment\(voidTarget, reason\)\)\}/);
});
