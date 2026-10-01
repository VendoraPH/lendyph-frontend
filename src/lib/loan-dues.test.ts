import { test } from "node:test";
import assert from "node:assert/strict";
import { currentDues, overdueWithPenalty } from "./loan-dues";

/**
 * A ₱60,000 loan over six months (₱10,000 principal + ₱1,800 interest a
 * period, 2% penalty) on 2026-03-01: period 1 is late and carries a ₱200
 * penalty, period 2 is not due yet. The server's `overdue_amount` is
 * ₱11,800 + ₱200 = ₱12,000, and `current_due` is the earliest unpaid
 * period, which is that same late period.
 */
const LATE = { current_due: 12000, overdue_amount: 12000, penalty_amount: 200 };

test("the overdue card counts the late period's penalty once", () => {
  assert.equal(overdueWithPenalty(LATE), 12000);
});

test("the dues the payment dialog previews count the late period once", () => {
  assert.equal(currentDues(LATE), 12000);
});

test("two late periods are due together, each penalty once", () => {
  // 2026-03-20: period 2 is late too, with its own ₱200.
  assert.equal(
    currentDues({ current_due: 12000, overdue_amount: 24000, penalty_amount: 400 }),
    24000,
  );
});

test("with nothing late, what is due now is the next instalment", () => {
  assert.equal(currentDues({ current_due: 11800, overdue_amount: 0, penalty_amount: 0 }), 11800);
  assert.equal(overdueWithPenalty({ overdue_amount: 0, penalty_amount: 0 }), 0);
});

test("missing figures count as nothing", () => {
  assert.equal(currentDues({}), 0);
  assert.equal(overdueWithPenalty({}), 0);
});
