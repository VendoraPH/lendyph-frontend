/**
 * The ledger row of an extension's "pay" collection.
 *
 * The ledger keeps the interest credit entry (it carries the description)
 * and hides the repayment it is linked to, so the money is never counted
 * twice. That repayment can also have collected insurance premium owed, so
 * the row takes its Total Paid and its premium from the repayment.
 *
 * WHAT THIS PROVES: the row shows the linked repayment's own server figures
 * (amount_paid, insurance_applied), the entry's amount only when there is no
 * readable repayment, and never a sum.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { creditEntryPaid, creditEntryRefNo, repaymentRefNo } from "./ledger-rows";

test("an extension collection shows its repayment's amount paid and premium", () => {
  // ₱1,800 interest + ₱400 premium taken in one payment of ₱2,200.
  assert.deepEqual(creditEntryPaid(1800, { amount_paid: 2200, insurance_applied: 400 }), {
    totalPaid: 2200,
    insuranceApplied: 400,
  });
  assert.deepEqual(creditEntryPaid(1800, { amount_paid: "2200.00", insurance_applied: "400.00" }), {
    totalPaid: 2200,
    insuranceApplied: 400,
  });
});

test("no premium collected shows none", () => {
  assert.deepEqual(creditEntryPaid(1800, { amount_paid: 1800, insurance_applied: 0 }), {
    totalPaid: 1800,
    insuranceApplied: null,
  });
});

test("without a readable linked repayment the entry's own amount stands, with no premium", () => {
  assert.deepEqual(creditEntryPaid(1800, null), { totalPaid: 1800, insuranceApplied: null });
  assert.deepEqual(creditEntryPaid(1800, { insurance_applied: 400 }), { totalPaid: 1800, insuranceApplied: null });
});

test("a repayment row's Ref No is its receipt number", () => {
  assert.equal(repaymentRefNo({ id: 12, receipt_number: "OR-2026-0042" }), "OR-2026-0042");
  assert.equal(repaymentRefNo({ id: 12, receipt_number: null }), "OR-000012");
});

test("an extension collection's Ref No is its linked repayment's receipt number", () => {
  assert.equal(creditEntryRefNo({ id: 12, receipt_number: "OR-2026-0042" }), "OR-2026-0042");
});

test("an entry with no readable linked repayment has no Ref No", () => {
  assert.equal(creditEntryRefNo(null), "—");
});
