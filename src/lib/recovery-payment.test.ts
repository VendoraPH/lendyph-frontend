import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RECOVERY_PAYMENT_NOTE,
  canRecordPaymentOn,
  isRecoveryPayment,
} from "./recovery-payment";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("a defaulted loan takes payments, as released and ongoing loans do", () => {
  for (const status of ["released", "ongoing", "current", "past_due", "defaulted"]) {
    assert.equal(canRecordPaymentOn(status), true, status);
  }
});

test("no other status offers Record Payment", () => {
  for (const status of ["draft", "for_review", "approved", "rejected", "completed", "restructured", "closed", "void", ""]) {
    assert.equal(canRecordPaymentOn(status), false, status);
  }
  assert.equal(canRecordPaymentOn(null), false);
  assert.equal(canRecordPaymentOn(undefined), false);
});

test("only a payment on a defaulted loan is a recovery payment", () => {
  assert.equal(isRecoveryPayment("defaulted"), true);
  for (const status of ["released", "ongoing", "completed", null, undefined]) {
    assert.equal(isRecoveryPayment(status), false, String(status));
  }
});

test("the note component renders only for a recovery payment and reads the shared text", () => {
  const note = read("src/components/common/recovery-payment-note.tsx");
  assert.match(note, /if \(!isRecoveryPayment\(status\)\) return null;/);
  assert.match(note, /\{RECOVERY_PAYMENT_NOTE\}/);
});

test("the recovery note says the loan stays Defaulted and no new penalty is charged", () => {
  assert.equal(
    RECOVERY_PAYMENT_NOTE,
    "Recovery payment: this loan stays Defaulted until it is paid in full. No new penalty is charged while it is defaulted.",
  );
});

test("the loan page offers Record Payment by the shared rule and shows the note in its dialog", () => {
  const page = read("src/app/(app)/loans/[id]/page.tsx");
  assert.match(page, /\{canRecordPaymentOn\(loan\.status\) && \(/);
  const dialog = page.slice(page.indexOf("<Dialog open={recordPaymentOpen}"));
  assert.match(dialog.slice(0, 4000), /<RecoveryPaymentNote status=\{loan\.status\}/);
});

test("the loan page doesn't offer to extend a defaulted loan on a partial payment", () => {
  const page = read("src/app/(app)/loans/[id]/page.tsx");
  assert.match(
    page,
    /if \(isUponMaturityLoan && paymentMode === "regular" && !isRecoveryPayment\(loan\.status\)\) \{\s*const decision = shouldPromptExtend\(/,
  );
});

test("Extend, Auto-Pay and New Adjustment keep their own released and ongoing rule", () => {
  const page = read("src/app/(app)/loans/[id]/page.tsx");
  const button = page.indexOf("{canRecordPaymentOn(loan.status) && (");
  const header = page.slice(page.lastIndexOf("headerExtra={", button), button);
  assert.ok(button > -1 && header.length > 0);
  // Extend Loan and Auto Pay still offer themselves on their own list, which
  // has no defaulted.
  assert.match(page, /isOneMonthTermLoan &&\s*\["released", "ongoing", "current", "past_due"\]\.includes\(loan\.status\)/);
  assert.match(page, /isUponMaturity &&\s*\["released", "ongoing", "current", "past_due"\]\.includes\(loan\.status\)/);
  assert.match(header, /\{\["released", "ongoing"\]\.includes\(loan\.status\) && \(\s*<PermissionButton\s+permission=\{LOAN_ADJUSTMENT_CREATE_GATE\.permission\}/);
});

test("Payment Entry shows the recovery note on a defaulted loan's dialog", () => {
  const page = read("src/app/(app)/payments/page.tsx");
  const dialog = page.slice(page.indexOf("{/* Payment Entry Dialog */}"));
  assert.match(dialog.slice(0, 4000), /<RecoveryPaymentNote status=\{selectedLoan\.status\}/);
});
