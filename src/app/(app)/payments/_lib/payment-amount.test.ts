/**
 * The payment amount check shared by Record Payment (loan page) and New
 * Payment (decision 2c, two decimals at most).
 *
 * WHAT THIS PROVES: an amount with more than two decimals gets the centavo
 * message and nothing to send; amounts to the centavo are sent as typed;
 * empty or unreadable input is no amount, with no message.
 * WHAT IT DOES NOT PROVE: the server's own refusal (422 on the amount), which
 * the backend's repayment tests pin and payment-errors.ts already shows.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CENTAVO_MESSAGE, checkPaymentAmount } from "./payment-amount";

test("more than two decimals gets the centavo message and nothing to send", () => {
  for (const raw of ["1500.005", "0.001", "10.123", "1e-3", 1500.555]) {
    assert.deepEqual(checkPaymentAmount(raw), { amount: null, error: CENTAVO_MESSAGE }, String(raw));
  }
  assert.equal(CENTAVO_MESSAGE, "Enter the amount to the centavo (two decimals).");
});

test("an amount to the centavo is sent as typed", () => {
  assert.deepEqual(checkPaymentAmount("1500"), { amount: 1500, error: null });
  assert.deepEqual(checkPaymentAmount("1500.5"), { amount: 1500.5, error: null });
  assert.deepEqual(checkPaymentAmount("10.50"), { amount: 10.5, error: null });
  assert.deepEqual(checkPaymentAmount(".75"), { amount: 0.75, error: null });
  assert.deepEqual(checkPaymentAmount(1500.55), { amount: 1500.55, error: null });
});

test("figures that float arithmetic would blur still count as two decimals", () => {
  // 1.15 * 100 is 114.99999999999999; a check by multiplying would refuse it.
  for (const raw of ["1.15", "0.29", "4.35", "1234567.89", "0.07"]) {
    assert.equal(checkPaymentAmount(raw).error, null, raw);
    assert.equal(checkPaymentAmount(raw).amount, Number(raw), raw);
  }
});

test("trailing zeros are still to the centavo", () => {
  assert.deepEqual(checkPaymentAmount("1500.500"), { amount: 1500.5, error: null });
  assert.deepEqual(checkPaymentAmount("1500.000"), { amount: 1500, error: null });
});

test("empty or unreadable input is no amount yet, with no message", () => {
  for (const raw of ["", "   ", "abc", "1.2.3", "Infinity"]) {
    assert.deepEqual(checkPaymentAmount(raw), { amount: null, error: null }, raw);
  }
});

test("zero and negatives pass the decimals check; the form's own check refuses them", () => {
  assert.deepEqual(checkPaymentAmount("0"), { amount: 0, error: null });
  assert.deepEqual(checkPaymentAmount("-5.25"), { amount: -5.25, error: null });
});
