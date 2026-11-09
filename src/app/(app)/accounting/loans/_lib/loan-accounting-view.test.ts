import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANY_BUCKET,
  LOAN_ACCOUNTING_PAGE_SIZE,
  accountNumberLabel,
  booksFigureViews,
  booksVsRecordsView,
  bucketFilterItems,
  bucketLabel,
  centavosOrDash,
  daysPastDueLabel,
  displayStatusLabel,
  groupFromValue,
  loanAccountingKey,
  loanAccountingQuery,
  memberLabel,
  shareBarValue,
  sharePercentLabel,
  type LoanAccountingFilters,
} from "./loan-accounting-view";

const FILTERS: LoanAccountingFilters = {
  asOf: "2026-11-09",
  branchId: undefined,
  bucket: ANY_BUCKET,
  pastDueOnly: false,
  search: "",
  group: "loan",
  page: 1,
};

// ── The query ──

test("the default query asks for one page of 25 loans, with no filter sent", () => {
  assert.equal(LOAN_ACCOUNTING_PAGE_SIZE, 25);
  assert.deepEqual(loanAccountingQuery(FILTERS), {
    as_of: "2026-11-09",
    page: 1,
    per_page: 25,
    group: "loan",
  });
});

test("past due only is sent only when on", () => {
  assert.equal(loanAccountingQuery({ ...FILTERS, pastDueOnly: true }).past_due_only, true);
  assert.equal("past_due_only" in loanAccountingQuery(FILTERS), false);
});

test("a bucket is sent; any bucket and an unknown value are not", () => {
  assert.equal(loanAccountingQuery({ ...FILTERS, bucket: "31_60" }).bucket, "31_60");
  assert.equal("bucket" in loanAccountingQuery({ ...FILTERS, bucket: ANY_BUCKET }), false);
  assert.equal("bucket" in loanAccountingQuery({ ...FILTERS, bucket: "60_90" }), false);
});

test("the search is trimmed with single spaces, and left out when blank", () => {
  assert.equal(
    loanAccountingQuery({ ...FILTERS, search: "  Dela   Cruz " }).search,
    "Dela Cruz",
  );
  assert.equal("search" in loanAccountingQuery({ ...FILTERS, search: "   " }), false);
});

test("the group switch picks the group sent", () => {
  assert.equal(loanAccountingQuery({ ...FILTERS, group: "member" }).group, "member");
  assert.equal(groupFromValue("member"), "member");
  assert.equal(groupFromValue("loan"), "loan");
  assert.equal(groupFromValue(null), "loan");
  assert.equal(groupFromValue("branch"), "loan");
});

test("the branch and page travel as given", () => {
  const query = loanAccountingQuery({ ...FILTERS, branchId: 3, page: 4 });
  assert.equal(query.branch_id, 3);
  assert.equal(query.page, 4);
});

test("the key differs for every change that asks the server again", () => {
  const base = loanAccountingKey(loanAccountingQuery(FILTERS));
  assert.equal(base, loanAccountingKey(loanAccountingQuery({ ...FILTERS })));
  assert.notEqual(base, loanAccountingKey(loanAccountingQuery({ ...FILTERS, group: "member" })));
  assert.notEqual(base, loanAccountingKey(loanAccountingQuery({ ...FILTERS, page: 2 })));
  assert.notEqual(base, loanAccountingKey(loanAccountingQuery({ ...FILTERS, pastDueOnly: true })));
});

// ── Labels ──

test("bucket labels are the aging report's", () => {
  assert.equal(bucketLabel("current"), "Current");
  assert.equal(bucketLabel("1_30"), "1–30 days");
  assert.equal(bucketLabel("over_120"), "Over 120 days");
});

test("the bucket filter starts with any bucket, then each bucket with the server's count", () => {
  const items = bucketFilterItems({
    current: 12,
    "1_30": 4,
    "31_60": 0,
    "61_90": 1,
    "91_120": 0,
    over_120: 2,
  });
  assert.deepEqual(items[0], { value: ANY_BUCKET, label: "Any bucket" });
  assert.deepEqual(items[1], { value: "current", label: "Current (12)" });
  assert.deepEqual(items[3], { value: "31_60", label: "31–60 days (0)" });
  assert.equal(items.length, 7);
});

test("without stats the bucket filter shows plain labels", () => {
  const items = bucketFilterItems(null);
  assert.deepEqual(items[2], { value: "1_30", label: "1–30 days" });
});

test("the share reads as the server's percent; a missing one is a dash", () => {
  assert.equal(sharePercentLabel("12.50"), "12.50%");
  assert.equal(sharePercentLabel("0.00"), "0.00%");
  assert.equal(sharePercentLabel(undefined), "—");
  assert.equal(sharePercentLabel("n/a"), "—");
});

test("the bar reads the server's percent, kept between 0 and 100", () => {
  assert.equal(shareBarValue("12.50"), 12.5);
  assert.equal(shareBarValue("100.00"), 100);
  assert.equal(shareBarValue("n/a"), 0);
});

test("a missing figure is a dash; zero is ₱0.00", () => {
  assert.equal(centavosOrDash(null), "—");
  assert.equal(centavosOrDash(undefined), "—");
  assert.equal(centavosOrDash(0), "₱0.00");
  assert.equal(centavosOrDash(150_050), "₱1,500.50");
});

test("days past due read in words", () => {
  assert.equal(daysPastDueLabel(0), "Not due");
  assert.equal(daysPastDueLabel(1), "1 day");
  assert.equal(daysPastDueLabel(31), "31 days");
});

test("statuses read in words", () => {
  assert.equal(displayStatusLabel("past_due"), "Past Due");
  assert.equal(displayStatusLabel("ongoing"), "Current");
  assert.equal(displayStatusLabel("defaulted"), "Defaulted");
  assert.equal(displayStatusLabel("something_new"), "Something new");
});

test("a member shows name and code only", () => {
  assert.equal(memberLabel({ id: 1, name: "Ana Cruz", code: "M-001" }), "Ana Cruz · M-001");
  assert.equal(memberLabel({ id: 1, name: "Ana Cruz", code: null }), "Ana Cruz");
});

// ── Books against records ──

const COMPARISON = {
  as_of: "2026-11-09",
  books_principal: 100,
  records_principal: 100,
  difference: 0,
  is_reconciled: true,
};

test("reconciled books say so, with the server's three figures", () => {
  const view = booksVsRecordsView(COMPARISON);
  assert.equal(view.status, "reconciled");
  assert.equal(view.label, "Reconciled");
  assert.deepEqual(
    view.figures.map((f) => f.value),
    ["₱1.00", "₱1.00", "₱0.00"],
  );
});

test("a difference is explained in plain words, pointing at opening balances", () => {
  const view = booksVsRecordsView({
    ...COMPARISON,
    books_principal: 0,
    difference: -100,
    is_reconciled: false,
  });
  assert.equal(view.status, "differs");
  assert.equal(view.label, "Not reconciled");
  assert.equal(view.figures[2].value, "-₱1.00");
  assert.match(view.text, /released before the books/i);
  assert.match(view.text, /opening balance/i);
  assert.doesNotMatch(view.text, /books_principal|records_principal|is_reconciled/);
});

test("before the server sends the comparison, every figure is a dash and nothing is claimed", () => {
  const view = booksVsRecordsView(undefined);
  assert.equal(view.status, "pending");
  assert.deepEqual(
    view.figures.map((f) => f.value),
    ["—", "—", "—"],
  );
  assert.doesNotMatch(view.label, /reconciled/i);
});

// ── The books ──

const BOOKS = {
  gross: 1_000_000,
  allowance: 50_000,
  unearned_income: 20_000,
  adjustments_clearing: 0,
  adjustments_clearing_needs_review: false,
  net: 930_000,
};

test("the books' figures are the server's, in order", () => {
  const view = booksFigureViews(BOOKS);
  assert.deepEqual(
    view.figures.map((f) => [f.label, f.value]),
    [
      ["Gross loans receivable", "₱10,000.00"],
      ["Less allowance for credit losses", "₱500.00"],
      ["Less unearned income on restructured loans", "₱200.00"],
      ["Net loans receivable", "₱9,300.00"],
      ["Loan adjustments clearing", "₱0.00"],
    ],
  );
  assert.equal(view.clearingNeedsReview, false);
});

test("the needs-review badge follows the server's flag, not the balance", () => {
  assert.equal(
    booksFigureViews({ ...BOOKS, adjustments_clearing: 0, adjustments_clearing_needs_review: true })
      .clearingNeedsReview,
    true,
  );
  assert.equal(
    booksFigureViews({ ...BOOKS, adjustments_clearing: 500, adjustments_clearing_needs_review: false })
      .clearingNeedsReview,
    false,
  );
});

test("before the server sends the books, each card is a dash and nothing needs review", () => {
  const view = booksFigureViews(undefined);
  assert.equal(view.figures.length, 5);
  assert.ok(view.figures.every((f) => f.value === "—"));
  assert.equal(view.clearingNeedsReview, false);
});

// ── Loan rows ──

test("an imported loan with no account number reads as a dash", () => {
  assert.equal(accountNumberLabel(null), "—");
  assert.equal(accountNumberLabel("LN-000004"), "LN-000004");
});
