/**
 * A Ledger row's Ref No.
 *
 * WHAT THIS PROVES: a payment row shows its receipt number, else its id as an
 * OR number.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { repaymentRefNo } from "./ledger-rows";

test("a repayment row's Ref No is its receipt number", () => {
  assert.equal(repaymentRefNo({ id: 12, receipt_number: "OR-2026-0042" }), "OR-2026-0042");
  assert.equal(repaymentRefNo({ id: 12, receipt_number: null }), "OR-000012");
});
