import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXPENSE_PAGE_SIZE,
  expenseCountsLine,
  expenseListQuery,
  expensePageToStepBackTo,
  expenseStatusCounts,
} from "./expense-list";

test("the list asks the server for one page of 25", () => {
  assert.equal(EXPENSE_PAGE_SIZE, 25);
  assert.deepEqual(expenseListQuery({ status: "any", search: "", page: 1 }), {
    page: 1,
    per_page: 25,
  });
});

test("the status filter goes to the server", () => {
  assert.deepEqual(expenseListQuery({ status: "overdue", search: "", page: 2 }), {
    page: 2,
    per_page: 25,
    status: "overdue",
  });
});

test("the Reversed filter goes to the server", () => {
  assert.deepEqual(expenseListQuery({ status: "reversed", search: "", page: 1 }), {
    page: 1,
    per_page: 25,
    status: "reversed",
  });
});

test("an unknown status is never sent", () => {
  assert.deepEqual(expenseListQuery({ status: "nonsense", search: "", page: 1 }), {
    page: 1,
    per_page: 25,
  });
});

test("the search goes to the server, trimmed, and is left out when blank", () => {
  assert.deepEqual(expenseListQuery({ status: "any", search: "  Meralco   Inc ", page: 1 }), {
    page: 1,
    per_page: 25,
    search: "Meralco Inc",
  });
  assert.equal("search" in expenseListQuery({ status: "any", search: "   ", page: 1 }), false);
});

test("a page left empty by a payment or a filter steps back, never forward", () => {
  assert.equal(expensePageToStepBackTo({ rows: 0, page: 3, lastPage: 2 }), 2);
  assert.equal(expensePageToStepBackTo({ rows: 0, page: 3, lastPage: 9 }), 2);
  assert.equal(expensePageToStepBackTo({ rows: 0, page: 1, lastPage: 1 }), null);
  assert.equal(expensePageToStepBackTo({ rows: 4, page: 3, lastPage: 3 }), null);
  assert.equal(expensePageToStepBackTo({ rows: 0, page: 2 }), 1);
});

test("the status counts are the server's stats, in the filter's order and words", () => {
  assert.deepEqual(
    expenseStatusCounts({ unpaid: 4, partially_paid: 1, paid: 12, overdue: 2, reversed: 3 }),
    [
      { status: "unpaid", label: "Unpaid", count: 4 },
      { status: "partially_paid", label: "Partially paid", count: 1 },
      { status: "paid", label: "Paid", count: 12 },
      { status: "overdue", label: "Overdue", count: 2 },
      { status: "reversed", label: "Reversed", count: 3 },
    ],
  );
  assert.deepEqual(expenseStatusCounts(undefined), []);
});

test("the counts line says reversed expenses are not in the totals", () => {
  const counts = expenseStatusCounts({ unpaid: 4, partially_paid: 1, paid: 12, overdue: 2, reversed: 3 });
  assert.equal(
    expenseCountsLine(counts, false),
    "4 unpaid · 1 partially paid · 12 paid · 2 overdue · 3 reversed (not in the totals)",
  );
  assert.equal(
    expenseCountsLine(expenseStatusCounts({ unpaid: 1, partially_paid: 0, paid: 0, overdue: 0, reversed: 0 }), true),
    "1 unpaid · 0 partially paid · 0 paid · 0 overdue · 0 reversed, matching the search",
  );
  assert.equal(expenseCountsLine([], false), "");
});
