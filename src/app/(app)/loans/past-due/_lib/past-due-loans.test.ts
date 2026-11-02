import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PAST_DUE_REQUEST_PARAMS,
  aggregateByLoan,
  mapRow,
  readPastDueTotals,
  summarizePastDue,
  type PastDueLoan,
} from "./past-due-loans";

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

// The server sends 0 for a period still inside its grace window. The old read
// treated 0 as missing and counted days from the due date in the browser.
test("days past due is the server's figure as sent, 0 included", () => {
  assert.equal(mapRow(periodRow({ days_past_due: 0, due_date: "2020-01-01" })).daysPastDue, 0);
  assert.equal(
    mapRow(periodRow({ days_past_due: undefined, days_overdue: 0, due_date: "2020-01-01" }))
      .daysPastDue,
    0,
  );
  assert.equal(mapRow(periodRow({ days_past_due: undefined, days_overdue: 14 })).daysPastDue, 14);
});

test("days past due falls back to the due date only when the server sends neither field", () => {
  const due = new Date(Date.now() - 10 * 86_400_000 - 3_600_000).toISOString();
  const loan = mapRow(periodRow({ days_past_due: undefined, due_date: due }));
  assert.equal(loan.daysPastDue, 10);
});

test("a row without loan_id is never keyed by its period id", () => {
  assert.equal(mapRow(periodRow({ id: 55, loan_id: undefined })).loanId, 0);
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
    [
      periodRow(),
      periodRow({ loan_id: 8, loan_past_due_amount: 100 }),
      periodRow({ id: 55, loan_id: undefined }),
      { id: 0 },
    ].map(mapRow),
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

const loaded = (over: Partial<PastDueLoan>): PastDueLoan => ({
  ...mapRow(periodRow()),
  ...over,
});

// The cards describe every loaded loan, the same set as the server totals
// beside them. The page's search and age filters narrow the table only.
test("summary counts every loaded loan and distinct member, whatever its figures", () => {
  const loans = [
    loaded({ loanId: 1, memberId: "M-001", daysPastDue: 120, pastDueAmount: 5_000 }),
    loaded({ loanId: 2, memberId: "M-001", daysPastDue: 0, pastDueAmount: 0 }),
    loaded({ loanId: 3, memberId: "M-002", daysPastDue: 3, pastDueAmount: null }),
  ];
  const summary = summarizePastDue(loans, { past_due_amount: 9_999.99, total_outstanding: 80_000 });
  assert.equal(summary.loanCount, 3);
  assert.equal(summary.memberCount, 2);
});

test("summary money is the server's totals, never a sum of the loans", () => {
  const loans = [
    loaded({ loanId: 1, pastDueAmount: 5_000, outstandingBalance: 40_000 }),
    loaded({ loanId: 2, pastDueAmount: 1_000, outstandingBalance: 10_000 }),
  ];
  const summary = summarizePastDue(loans, { past_due_amount: "7250.50", total_outstanding: 0 });
  assert.equal(summary.pastDueAmount, 7_250.5);
  assert.equal(summary.totalOutstanding, 0);

  const absent = summarizePastDue(loans, null);
  assert.equal(absent.pastDueAmount, null);
  assert.equal(absent.totalOutstanding, null);
});

// Decision 2b: the page asks GET /reports/due-past-due for rows past grace
// only, so a loan still inside its grace period is not listed, and the
// server's totals (the money cards) follow the same filter.
test("the page requests only rows past grace", () => {
  assert.deepEqual(PAST_DUE_REQUEST_PARAMS, { past_due_only: 1 });
});
