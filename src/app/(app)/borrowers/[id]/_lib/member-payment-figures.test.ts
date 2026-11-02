import { test } from "node:test";
import assert from "node:assert/strict";
import type { BorrowerLoanSummary } from "@/types";
import { memberPaymentFigures } from "./member-payment-figures";

const summary = (over: Partial<Record<keyof BorrowerLoanSummary, unknown>> = {}) =>
  ({
    total_borrowed: 120_000,
    total_outstanding: 70_800,
    outstanding_principal: 60_000,
    overdue_amount: 11_800,
    total_paid: 2_000,
    insurance_paid: 400,
    current_loans: 1,
    counts: { ongoing: 1 },
    ...over,
  }) as unknown as BorrowerLoanSummary;

// The bug: Overdue was the WHOLE outstanding balance of any loan whose next due
// date had passed, so a loan ₱11,800 behind on ₱60,000 showed ₱60,000 overdue.
test("the cards are the loan-summary's own figures", () => {
  assert.deepEqual(memberPaymentFigures(summary()), {
    totalPaid: "₱2,000.00",
    outstanding: "₱70,800.00",
    overdue: "₱11,800.00",
  });
});

test("zero is a real figure and shows as ₱0.00", () => {
  const f = memberPaymentFigures(summary({ overdue_amount: 0, total_outstanding: "0.00" }));
  assert.equal(f.overdue, "₱0.00");
  assert.equal(f.outstanding, "₱0.00");
});

test("a figure the server did not send shows a dash", () => {
  const f = memberPaymentFigures(summary({ overdue_amount: undefined, total_paid: null }));
  assert.equal(f.overdue, "—");
  assert.equal(f.totalPaid, "—");
  assert.equal(f.outstanding, "₱70,800.00");
});

test("no summary at all (loading or failed) shows dashes, not sums of the rows", () => {
  assert.deepEqual(memberPaymentFigures(null), { totalPaid: "—", outstanding: "—", overdue: "—" });
});
