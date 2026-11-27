import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareFigure,
  mergeLoanFigure,
  readRowOutstanding,
} from "./past-due-outstanding";

// "Outstanding" is everything owed on the loan. GET /reports/due-past-due
// sends it on every row as `loan_total_outstanding` (m5 decision 3).
test("reads the row's loan_total_outstanding", () => {
  assert.equal(readRowOutstanding({ loan_total_outstanding: 70_800 }), 70_800);
  assert.equal(readRowOutstanding({ loan_total_outstanding: "1500.50" }), 1500.5);
  assert.equal(readRowOutstanding({ loan_total_outstanding: 0 }), 0);
  assert.equal(readRowOutstanding({ loan_total_outstanding: null }), null);
});

test("never reads the deprecated principal + premium figure or a period balance", () => {
  assert.equal(
    readRowOutstanding({ outstanding_balance: 60_400, remaining_balance: 5_000, balance: 11_800 }),
    null,
  );
  assert.equal(readRowOutstanding({ loan: { outstanding_balance: 60_400 } }), null);
  assert.equal(readRowOutstanding({ loan: null }), null);
});

test("never reads a figure the report does not define for this row", () => {
  assert.equal(readRowOutstanding({ total_outstanding: 70_800 }), null);
  assert.equal(readRowOutstanding({ loan: { total_outstanding: 70_800 } }), null);
});

test("merging a loan's period rows keeps the figure, never adds them", () => {
  assert.equal(mergeLoanFigure(70_800, 70_800), 70_800);
  assert.equal(mergeLoanFigure(null, 70_800), 70_800);
  assert.equal(mergeLoanFigure(70_800, null), 70_800);
  assert.equal(mergeLoanFigure(null, null), null);
});

test("merging keeps the first real figure, never picks the larger", () => {
  assert.equal(mergeLoanFigure(500, 70_800), 500);
  assert.equal(mergeLoanFigure(0, 70_800), 0);
});

test("sorting keeps rows with no figure last in both directions, zero included", () => {
  const values = [500, null, 0, 70_800, null];
  assert.deepEqual(
    [...values].sort((a, b) => compareFigure(a, b, "asc")),
    [0, 500, 70_800, null, null],
  );
  assert.deepEqual(
    [...values].sort((a, b) => compareFigure(a, b, "desc")),
    [70_800, 500, 0, null, null],
  );
});
