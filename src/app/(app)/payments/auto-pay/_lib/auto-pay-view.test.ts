import { test } from "node:test";
import assert from "node:assert/strict";
import type { AutoPayFilter, AutoPayPartialRow, AutoPayPreview, AutoPayResult } from "@/types";
import {
  autoPayTotalsKey,
  loanIssues,
  loansAffected,
  previewTotals,
  runOutcome,
  runTotals,
  selectionView,
} from "./auto-pay-view";

const partial = (loan_id: number, schedule_id: number): AutoPayPartialRow => ({
  loan_id,
  schedule_id,
  borrower_name: "J. Cruz",
  loan_account: `LN-${loan_id}`,
  due_date: "2026-10-15",
  period_number: 3,
  total_due: 1_000,
  amount_paid: 400,
  remaining_balance: 650,
  principal_remaining: 500,
  interest_remaining: 100,
  penalty_remaining: 50,
});

// Figures no browser sum would produce from the rows: they are the server's.
const preview: AutoPayPreview = {
  summary: {
    total_principal: 10_000.1,
    total_interest: 1_234.56,
    total_penalty: 77.7,
    total_amount: 11_312.36,
    loans_count: 2,
  },
  loans: [
    { loan_id: 1, loan_account_number: "LN-1", borrower_name: "A. Reyes", total_principal: 1, total_interest: 1, total_penalty: 1, total_amount: 3 },
    { loan_id: 2, loan_account_number: "LN-2", borrower_name: "B. Santos", total_principal: 1, total_interest: 1, total_penalty: 1, total_amount: 3 },
  ],
  partial_rows: [partial(2, 20), partial(3, 30), partial(3, 31)],
  skips: [{ loan_id: 9, loan_account_number: "LN-9", reason: "Has earlier unpaid periods; collect them first." }],
};

test("the preview totals are the server's summary, as sent", () => {
  assert.deepEqual(previewTotals(preview.summary), {
    principal: 10_000.1,
    interest: 1_234.56,
    penalty: 77.7,
    amount: 11_312.36,
  });
});

test("a summary without a penalty figure shows none, not zero", () => {
  const older = { ...preview.summary, total_penalty: undefined };
  assert.equal(previewTotals(older).penalty, null);
});

test("loans affected counts each loan once, full dues and included part-paid rows", () => {
  assert.equal(loansAffected(preview, new Set()), 2);
  // Loan 2 is already counted; loan 3 has two included rows.
  assert.equal(loansAffected(preview, new Set([20, 30, 31])), 3);
});

test("nothing to run when no loan has full dues and no part-paid row is included", () => {
  const empty: AutoPayPreview = { ...preview, loans: [], partial_rows: [partial(3, 30)] };
  assert.equal(loansAffected(empty, new Set()), 0);
  assert.equal(loansAffected(empty, new Set([30])), 1);
});

test("skipped and failed loans keep the server's reason and account", () => {
  assert.deepEqual(loanIssues(preview.skips), [
    { loanId: 9, account: "LN-9", reason: "Has earlier unpaid periods; collect them first." },
  ]);
});

test("a loan issue without an account number is named by its id", () => {
  assert.deepEqual(loanIssues([{ loan_id: 4, loan_account_number: null, reason: "x" }]), [
    { loanId: 4, account: "Loan #4", reason: "x" },
  ]);
});

test("a missing list is an empty one", () => {
  assert.deepEqual(loanIssues(undefined), []);
});

test("the run outcome carries the server's counts and both lists", () => {
  const result: AutoPayResult = {
    processed: 5,
    skipped: 1,
    failed: 1,
    repayments: [],
    skips: [{ loan_id: 7, loan_account_number: "LN-7", reason: "Nothing is due on the selected periods." }],
    failures: [{ loan_id: 8, loan_account_number: "LN-8", reason: "The books are closed for that period." }],
  };
  assert.deepEqual(runOutcome(result), {
    processed: 5,
    skipped: 1,
    failed: 1,
    skips: [{ loanId: 7, account: "LN-7", reason: "Nothing is due on the selected periods." }],
    failures: [{ loanId: 8, account: "LN-8", reason: "The books are closed for that period." }],
  });
});

test("a run answer without lists still reports its counts", () => {
  const result: AutoPayResult = { processed: 2, skipped: 0, failed: 0, repayments: [] };
  assert.deepEqual(runOutcome(result), { processed: 2, skipped: 0, failed: 0, skips: [], failures: [] });
});

const filter: AutoPayFilter = { product_ids: [2, 1], date_from: "2026-10-01", date_to: "2026-10-31" };

test("the run total is the server's grand total and part-paid total, as sent", () => {
  // Not total_amount plus the rows: figures the browser would not get by adding.
  assert.deepEqual(
    runTotals({ ...preview.summary, partial_total: 650.01, grand_total: 11_999.99 }),
    { partialTotal: 650.01, grandTotal: 11_999.99 },
  );
});

test("a summary without the run total has none, not a browser stand-in", () => {
  assert.equal(runTotals(preview.summary), null);
  assert.equal(runTotals({ ...preview.summary, partial_total: 0 }), null);
});

test("the totals request is keyed by the filter and the selection, in any order", () => {
  assert.equal(autoPayTotalsKey(filter, new Set([31, 20])), autoPayTotalsKey(filter, new Set([20, 31])));
  assert.notEqual(autoPayTotalsKey(filter, new Set([20])), autoPayTotalsKey(filter, new Set([20, 31])));
  assert.deepEqual(JSON.parse(autoPayTotalsKey(filter, new Set([31, 20]))), {
    product_ids: [2, 1],
    date_from: "2026-10-01",
    date_to: "2026-10-31",
    include_schedule_ids: [20, 31],
  });
});

// The preview asked again with the current selection answers everything on
// the review step: a loan cleared by selecting its part-paid row leaves the
// skip list and joins the cards.
const KEY = autoPayTotalsKey(filter, new Set([20]));
const selected: AutoPayPreview = {
  ...preview,
  summary: { ...preview.summary, total_principal: 13_000, partial_total: 650, grand_total: 15_000 },
  loans: [...(preview.loans ?? []), { loan_id: 9, loan_account_number: "LN-9", borrower_name: "C. Lim", total_principal: 3_000, total_interest: 0, total_penalty: 0, total_amount: 3_000 }],
  skips: [],
};

test("the current selection's answer is the source of cards, loans, skips and run total", () => {
  const view = selectionView(preview, null, { key: KEY, preview: selected, error: null }, KEY);
  assert.equal(view.preview, selected);
  assert.equal(view.upToDate, true);
  assert.deepEqual(view.run, { partialTotal: 650, grandTotal: 15_000 });
  assert.equal(view.error, null);
});

test("while the selection's answer is on its way, the last answer is shown and nothing can run", () => {
  const older = { key: "older", preview: selected, error: null };
  const view = selectionView(preview, selected, older, KEY);
  assert.equal(view.preview, selected);
  assert.equal(view.upToDate, false);
  assert.equal(view.run, null);
  assert.equal(view.error, null);
});

test("before any answer the first preview is shown, and nothing can run", () => {
  const view = selectionView(preview, null, null, KEY);
  assert.equal(view.preview, preview);
  assert.equal(view.upToDate, false);
  assert.equal(view.run, null);
});

test("a refused selection keeps the last answer on screen and says why", () => {
  const view = selectionView(preview, selected, { key: KEY, preview: null, error: "Refused." }, KEY);
  assert.equal(view.preview, selected);
  assert.equal(view.upToDate, false);
  assert.equal(view.run, null);
  assert.equal(view.error, "Refused.");
});

test("an answer without the run total cannot be run", () => {
  const view = selectionView(preview, null, { key: KEY, preview, error: null }, KEY);
  assert.equal(view.run, null);
  assert.match(view.error ?? "", /run total/);
});
