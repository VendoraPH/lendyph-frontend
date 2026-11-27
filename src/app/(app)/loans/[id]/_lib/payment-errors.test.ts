/**
 * What the Record Payment dialog says when the server refuses a payment.
 *
 * Decision 4 (2026-11-02): a payment dated before the loan's release date is a
 * 422 on `payment_date`. The dialog used to drop the preview's error and say
 * "We couldn't record the payment" on submit, so the cashier never learnt why.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { previewRefusalMessage, recordPaymentErrorMessage } from "./payment-errors";

const BEFORE_RELEASE = "The payment date can't be before the loan's release date (2026-11-02).";

function httpError(status: number, data: unknown) {
  return { isAxiosError: true, request: {}, response: { status, data } };
}

const refusedDate = httpError(422, {
  message: BEFORE_RELEASE,
  errors: { payment_date: [BEFORE_RELEASE] },
});

test("a preview refused with a 422 states the server's field error", () => {
  assert.equal(previewRefusalMessage(refusedDate), BEFORE_RELEASE);
});

test("a 422 with a message and no field errors states the message", () => {
  assert.equal(
    previewRefusalMessage(httpError(422, { message: "The amount paid must be at least ₱1.00." })),
    "The amount paid must be at least ₱1.00.",
  );
});

test("a preview that failed for any other reason is not a refusal", () => {
  assert.equal(previewRefusalMessage(httpError(500, { message: "Server Error" })), null);
  assert.equal(previewRefusalMessage(httpError(409, { message: "Try again." })), null);
  assert.equal(previewRefusalMessage({ isAxiosError: true, request: {}, response: undefined }), null);
  assert.equal(previewRefusalMessage(new Error("boom")), null);
  assert.equal(previewRefusalMessage(null), null);
});

test("a refused submit states the server's message, not the generic one", () => {
  assert.equal(recordPaymentErrorMessage(refusedDate), BEFORE_RELEASE);
  assert.equal(
    recordPaymentErrorMessage(httpError(409, { message: "Another payment is being recorded on this loan." })),
    "Another payment is being recorded on this loan.",
  );
});

test("a submit that failed with nothing to explain keeps the fallback", () => {
  assert.equal(recordPaymentErrorMessage(new Error("boom")), "We couldn't record the payment. Please try again.");
});
