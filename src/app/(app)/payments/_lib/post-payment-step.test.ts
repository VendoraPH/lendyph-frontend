/**
 * Payment Entry's Post Payment on a loan that can be extended.
 *
 * A partial payment on a one-month loan used to post straight away here,
 * while the loan page asked "Extend loan?" first.
 *
 * WHAT THIS PROVES: only a loan the server says can be extended asks, from the
 * server's dated preview for exactly this loan, amount and date; until that
 * preview has answered, or when it failed, nothing is posted. Any other loan
 * posts as before.
 * WHAT IT DOES NOT PROVE: the badge itself, which is the server's.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RepaymentPreview } from "@/services/repayment.service";
import { readAmountDueNow } from "@/lib/payment-figures";
import { postPaymentStep } from "./post-payment-step";

const DUE = readAmountDueNow({
  amount: 10300,
  insurance: 0,
  principal: 10000,
  interest: 300,
  penalty: 0,
  share_capital_build_up: 0,
  period_number: 1,
  last_period_number: 1,
  schedule_id: 41,
});

const ONE_MONTH = { is_one_month_term: true, status: "released", amount_due_now: DUE };

function answer(type: "partial" | "exact" | "advance"): { preview: RepaymentPreview; error: null } {
  return { preview: { payment_badge: { type, label: type } }, error: null };
}

test("a one-month loan's partial payment asks Extend loan? before anything posts", () => {
  assert.equal(postPaymentStep(ONE_MONTH, answer("partial")), "prompt");
  assert.equal(postPaymentStep({ ...ONE_MONTH, status: "ongoing" }, answer("partial")), "prompt");
});

test("a one-month loan's exact or advance payment posts", () => {
  assert.equal(postPaymentStep(ONE_MONTH, answer("exact")), "post");
  assert.equal(postPaymentStep(ONE_MONTH, answer("advance")), "post");
});

test("any other loan posts as is, partial or not, without waiting for the preview", () => {
  const threeMonths = { ...ONE_MONTH, is_one_month_term: false };
  assert.equal(postPaymentStep(threeMonths, answer("partial")), "post");
  assert.equal(postPaymentStep(threeMonths, null), "post");
  // Not known (the table's row before the full loan loads): never assumed.
  assert.equal(postPaymentStep({ ...ONE_MONTH, is_one_month_term: null }, answer("partial")), "post");
  // A defaulted loan's payment is a recovery payment, never extended.
  assert.equal(postPaymentStep({ ...ONE_MONTH, status: "defaulted" }, answer("partial")), "post");
});

test("a one-month loan waits for the server's preview of exactly this payment", () => {
  assert.equal(postPaymentStep(ONE_MONTH, null), "unknown");
  assert.equal(postPaymentStep(ONE_MONTH, { preview: null, error: null }), "unknown");
});

test("a failed preview says so, and nothing posts", () => {
  assert.equal(postPaymentStep(ONE_MONTH, { preview: null, error: "We couldn't reach the server." }), "failed");
});

test("with no period open there is nothing to extend, so it posts", () => {
  const premiumOnly = readAmountDueNow({
    amount: 400,
    insurance: 400,
    principal: 0,
    interest: 0,
    penalty: 0,
    share_capital_build_up: 0,
    period_number: null,
    last_period_number: null,
    schedule_id: null,
  });
  assert.equal(postPaymentStep({ ...ONE_MONTH, amount_due_now: premiumOnly }, null), "post");
  // No figure sent at all: the preview decides.
  assert.equal(postPaymentStep({ ...ONE_MONTH, amount_due_now: null }, answer("partial")), "prompt");
});
