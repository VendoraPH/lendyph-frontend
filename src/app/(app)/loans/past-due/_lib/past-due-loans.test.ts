import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateByLoan, mapRow, readPastDueTotals } from "./past-due-loans";

// Two period rows of one loan, as GET /reports/due-past-due sends them: the
// period's own gross figures differ, the loan-level figures repeat.
const periodRow = (over: Record<string, unknown> = {}) => ({
  id: 11,
  loan_id: 7,
  loan_account_number: "LN-0007",
  borrower_name: "Juan Dela Cruz",
  borrower_code: "M-001",
  branch_name: "Main",
  due_date: "2026-09-01",
  days_past_due: 62,
  principal_due: 5_000,
  interest_due: 800,
  penalty_amount: 120,
  loan_total_outstanding: 45_250.5,
  loan_past_due_amount: 9_310.25,
  loan_last_payment_date: "2026-08-30",
  ...over,
});

// Decision 3: the Past Due Amount, Outstanding and Last Payment are the
// loan-level server figures. The old mapping added principal_due +
// interest_due + penalty_amount, gross of what was already paid.
test("a row's figures are the loan-level server figures, not the period's gross dues", () => {
  const loan = mapRow(periodRow());
  assert.equal(loan.pastDueAmount, 9_310.25);
  assert.equal(loan.outstandingBalance, 45_250.5);
  assert.equal(loan.lastPaymentDate, "2026-08-30");
  assert.equal(loan.daysPastDue, 62);
  assert.equal(loan.loanId, 7);
});

test("missing loan figures stay null (a dash), and ₱0.00 stays a real zero", () => {
  const missing = mapRow({ id: 3, loan_id: 9, principal_due: 5_000, interest_due: 800 });
  assert.equal(missing.pastDueAmount, null);
  assert.equal(missing.outstandingBalance, null);
  assert.equal(missing.lastPaymentDate, null);

  const zero = mapRow(periodRow({ loan_past_due_amount: 0, loan_total_outstanding: "0.00" }));
  assert.equal(zero.pastDueAmount, 0);
  assert.equal(zero.outstandingBalance, 0);
});

test("the last payment date is the loan's server date only", () => {
  const loan = mapRow(periodRow({ loan_last_payment_date: null, last_payment_date: "2026-01-01" }));
  assert.equal(loan.lastPaymentDate, null);
});

test("grouping a loan's period rows never adds money", () => {
  const [loan, ...rest] = aggregateByLoan(
    [
      periodRow({ id: 11, days_past_due: 62 }),
      periodRow({ id: 12, days_past_due: 31, principal_due: 5_000 }),
      periodRow({ id: 13, days_past_due: 1 }),
    ].map(mapRow),
  );
  assert.equal(rest.length, 0);
  assert.equal(loan.pastDueAmount, 9_310.25);
  assert.equal(loan.outstandingBalance, 45_250.5);
  assert.equal(loan.lastPaymentDate, "2026-08-30");
  assert.equal(loan.daysPastDue, 62, "the oldest period sets the loan's age");
});

test("grouping keeps a loan figure a later row carries when the first row lacks it", () => {
  const [loan] = aggregateByLoan(
    [
      periodRow({ loan_past_due_amount: null, loan_total_outstanding: null, loan_last_payment_date: null }),
      periodRow(),
    ].map(mapRow),
  );
  assert.equal(loan.pastDueAmount, 9_310.25);
  assert.equal(loan.outstandingBalance, 45_250.5);
  assert.equal(loan.lastPaymentDate, "2026-08-30");
});

test("grouping keeps separate loans apart and drops rows with no loan id", () => {
  const loans = aggregateByLoan(
    [periodRow(), periodRow({ loan_id: 8, loan_past_due_amount: 100 }), { id: 0 }].map(mapRow),
  );
  assert.deepEqual(
    loans.map((l) => [l.loanId, l.pastDueAmount]),
    [
      [7, 9_310.25],
      [8, 100],
    ],
  );
});

// Summary cards: the server's totals, once per distinct loan. Never a browser sum.
test("summary totals read the server's past_due_amount and total_outstanding", () => {
  assert.deepEqual(
    readPastDueTotals({ count: 40, total_due: 1, past_due_amount: "12500.75", total_outstanding: 0 }),
    { pastDueAmount: 12_500.75, totalOutstanding: 0 },
  );
});

test("summary totals the server didn't send are null, so the card shows a dash", () => {
  assert.deepEqual(readPastDueTotals({ count: 40, total_due: 1_000, total_balance: 900 }), {
    pastDueAmount: null,
    totalOutstanding: null,
  });
  assert.deepEqual(readPastDueTotals(null), { pastDueAmount: null, totalOutstanding: null });
});
