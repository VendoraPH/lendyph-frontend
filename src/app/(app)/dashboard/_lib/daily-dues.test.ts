import { test } from "node:test";
import assert from "node:assert/strict";
import { dueAmountLabel, dueItemViews } from "./daily-dues";

test("a zero paid reads ₱0.00; only a missing figure reads a dash", () => {
  assert.equal(dueAmountLabel(0), "₱0.00");
  assert.equal(dueAmountLabel(1250.5), "₱1,250.50");
  assert.equal(dueAmountLabel(null), "—");
});

test("rows keep the server's amounts as sent, and a figure it left out stays missing", () => {
  const [paidNothing, noFigure] = dueItemViews([
    { id: 7, borrower_name: "Ana Cruz", loan_account_number: "LN-000007", amount_due: 500, amount_paid: 0, status: "pending" },
    { loan_id: 9, status: "partial" },
  ]);
  assert.deepEqual(paidNothing, {
    id: 7,
    borrower: "Ana Cruz",
    loanId: "LN-000007",
    amountDue: 500,
    amountPaid: 0,
    status: "pending",
  });
  assert.equal(noFigure.amountDue, null);
  assert.equal(noFigure.amountPaid, null);
  assert.equal(noFigure.id, 2);
  assert.equal(noFigure.loanId, "9");
  assert.equal(noFigure.borrower, "—");
});

test("the server's statuses map to the table's three, overdue reading pending", () => {
  const statuses = dueItemViews([{ status: "paid" }, { status: "collected" }, { status: "partial" }, { status: "overdue" }, {}]).map(
    (r) => r.status,
  );
  assert.deepEqual(statuses, ["collected", "collected", "partial", "pending", "pending"]);
});
