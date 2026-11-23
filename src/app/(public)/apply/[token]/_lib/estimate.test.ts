import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateHeadline } from "./estimate";

// The estimate's `installment` is the server's HIGHEST row total
// (`PublicEstimate::estimate()`): payments 1 to 5 of ₱9,833.33 and a last of
// ₱9,833.35 send ₱9,833.35. The headline says "up to" and never works out a
// "regular" payment itself (browser check of #657).

test("the headline reads the highest payment as an upper bound, with the schedule in words", () => {
  assert.equal(
    estimateHeadline({ installment: 9833.35, installments_count: 6, frequency: "monthly" }),
    "Up to ₱9,833.35 a month · 6 monthly payments",
  );
});

test("the server's two-decimal string reads the same", () => {
  assert.equal(
    estimateHeadline({ installment: "9833.35", installments_count: 6, frequency: "monthly" }),
    "Up to ₱9,833.35 a month · 6 monthly payments",
  );
});

test("weekly and daily schedules read their own period", () => {
  assert.equal(estimateHeadline({ installment: 1234.5, installments_count: 26, frequency: "weekly" }), "Up to ₱1,234.50 a week · 26 weekly payments");
  assert.equal(estimateHeadline({ installment: 120, installments_count: 60, frequency: "daily" }), "Up to ₱120.00 a day · 60 daily payments");
});

test("other schedules read per payment", () => {
  assert.equal(
    estimateHeadline({ installment: 5000, installments_count: 12, frequency: "semi_monthly" }),
    "Up to ₱5,000.00 a payment · 12 semi-monthly payments",
  );
  assert.equal(
    estimateHeadline({ installment: 2600, installments_count: 13, frequency: "bi_weekly" }),
    "Up to ₱2,600.00 a payment · 13 bi-weekly payments",
  );
});

test("a single payment is that payment, not an upper bound", () => {
  assert.equal(estimateHeadline({ installment: 51500, installments_count: 1, frequency: "upon_maturity" }), "₱51,500.00 in one payment");
});
