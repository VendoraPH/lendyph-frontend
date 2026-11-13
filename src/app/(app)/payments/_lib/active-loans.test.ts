import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Loan } from "@/types";
import * as activeLoans from "./active-loans";
import {
  ACTIVE_LOANS_PER_PAGE,
  ACTIVE_LOAN_SEARCH_DEBOUNCE_MS,
  activeLoanCardParams,
  activeLoanDueCell,
  activeLoanInterestText,
  activeLoanListParams,
  loanHasBuildUp,
  activeLoanRateText,
  mapLoanToActiveLoan,
  normaliseLoanSearch,
  pageAfterEmptyAnswer,
  readActiveLoanPage,
  readLoanListTotals,
  withSummaryPenaltyNote,
} from "./active-loans";

/** A `GET /loans?view=summary` row: the agreed fields, and no schedule. */
function summaryRow(overrides: Record<string, unknown> = {}): Loan {
  return {
    id: 7,
    application_number: "LA-7",
    loan_account_number: "LN-7",
    borrower: { id: 3, full_name: "Maria Santos", borrower_code: "M-3" },
    loan_product: { id: 2, name: "Salary Loan" },
    branch: { id: 1, name: "Main" },
    principal_amount: 20000,
    term: 12,
    frequency: "monthly",
    status: "ongoing",
    display_status: "ongoing",
    released_at: "2026-10-01",
    next_due_date: "2026-11-30",
    next_due_amount: 1833.34,
    total_outstanding: 21000.5,
    outstanding_principal: 18000,
    overdue_amount: 0,
    ...overrides,
  } as unknown as Loan;
}

// The screen used to drain every active loan: 32 MB raw at 2,000 loans, and it
// stopped there. Everything it asks for now is one summary page.
test("asks the server for one summary page of active loans", () => {
  assert.equal(ACTIVE_LOANS_PER_PAGE, 25);
  assert.deepEqual(activeLoanListParams({ query: "", page: 1, perPage: ACTIVE_LOANS_PER_PAGE }), {
    status: "active",
    view: "summary",
    sort: "next_due",
    dir: "asc",
    page: 1,
    per_page: 25,
  });
});

// A cashier's queue: the earliest unpaid due date first, so overdue loans lead
// every page. The server has to sort it, since a browser sort only sees one page.
test("every page asks the server for the earliest due date first", () => {
  for (const query of ["", "santos"]) {
    const params = activeLoanListParams({ query, page: 2, perPage: 25 });
    assert.equal(params.sort, "next_due");
    assert.equal(params.dir, "asc");
  }
});

test("the search goes to the server with the page", () => {
  assert.deepEqual(activeLoanListParams({ query: "santos", page: 3, perPage: 50 }), {
    status: "active",
    view: "summary",
    sort: "next_due",
    dir: "asc",
    page: 3,
    per_page: 50,
    search: "santos",
  });
});

test("the search waits for typing to pause for 300 ms", () => {
  assert.equal(ACTIVE_LOAN_SEARCH_DEBOUNCE_MS, 300);
});

test("what was typed is trimmed and inner spaces collapse", () => {
  assert.equal(normaliseLoanSearch("  maria   santos "), "maria santos");
  assert.equal(normaliseLoanSearch("   "), "");
});

test("the cards' own read is the smallest page of the unsearched list", () => {
  assert.deepEqual(activeLoanCardParams(), {
    status: "active",
    view: "summary",
    per_page: 1,
  });
});

test("reads the rows, the page count, the total and the server's totals", () => {
  const page = readActiveLoanPage({
    data: [summaryRow()],
    meta: {
      current_page: 2,
      last_page: 4,
      per_page: 25,
      total: 80,
      totals: { total_outstanding: "141600.50", overdue_amount: 11800, overdue_count: 1 },
    },
  });

  assert.deepEqual(page.rows.map((row) => row.id), [7]);
  assert.equal(page.total, 80);
  assert.equal(page.lastPage, 4);
  assert.deepEqual(page.totals, {
    total_outstanding: 141600.5,
    overdue_amount: 11800,
    overdue_count: 1,
  });
});

test("an empty portfolio is a real zero, not unknown", () => {
  const page = readActiveLoanPage({
    data: [],
    meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 },
  });

  assert.equal(page.total, 0);
  assert.deepEqual(page.rows, []);
});

test("a response with no meta states no total, and is one page", () => {
  const page = readActiveLoanPage({ data: [summaryRow()] });

  assert.equal(page.total, null);
  assert.equal(page.lastPage, 1);
  assert.equal(page.totals, null);
});

test("a figure the server did not send is null, never 0", () => {
  assert.deepEqual(
    readLoanListTotals({ meta: { totals: { total_outstanding: 500, overdue_amount: null } } }),
    { total_outstanding: 500, overdue_amount: null, overdue_count: null },
  );
});

test("no meta.totals at all gives null totals, not a browser sum", () => {
  assert.equal(readLoanListTotals({ data: [summaryRow()], meta: { total: 1 } }), null);
});

// A payment can settle the only loan on the last page.
test("an empty answer past the last page steps back to the last page", () => {
  assert.equal(pageAfterEmptyAnswer({ requested: 4, lastPage: 3, rowCount: 0 }), 3);
});

test("a page with rows, and page 1, stay where they are", () => {
  assert.equal(pageAfterEmptyAnswer({ requested: 4, lastPage: 4, rowCount: 2 }), null);
  assert.equal(pageAfterEmptyAnswer({ requested: 1, lastPage: 1, rowCount: 0 }), null);
});

test("a summary row maps to the table's fields", () => {
  const loan = mapLoanToActiveLoan(summaryRow());

  assert.equal(loan.id, 7);
  assert.equal(loan.loan_account_number, "LN-7");
  assert.equal(loan.borrower_name, "Maria Santos");
  assert.equal(loan.loan_product_name, "Salary Loan");
  assert.equal(loan.next_due_date, "2026-11-30");
  assert.equal(loan.next_due_amount, 1833.34);
  assert.equal(loan.total_outstanding, 21000.5);
  assert.equal(loan.overdue_amount, 0);
});

test("what a summary row doesn't carry stays unknown until the full loan loads", () => {
  const loan = mapLoanToActiveLoan(summaryRow());

  assert.equal(loan.interest_rate, null);
  assert.equal(loan.amount_due_now, null);
});

test("a full loan fills in the dialog's figures", () => {
  const loan = mapLoanToActiveLoan(
    summaryRow({
      interest_rate: 1.5,
      interest_method: "diminishing",
      amount_due_now: {
        amount: 2000,
        insurance: 0,
        penalty: 100,
        interest: 300,
        principal: 1600,
        share_capital_build_up: 0,
        period_number: 2,
        last_period_number: 2,
        schedule_id: 9,
        as_of: "2026-11-05",
      },
    }),
  );

  assert.equal(loan.interest_rate, 1.5);
  assert.equal(loan.interest_type, "diminishing");
  assert.equal(loan.amount_due_now?.amount, 2000);
});

test("the dialog's rate reads with the period it is quoted per", () => {
  assert.equal(
    activeLoanRateText(mapLoanToActiveLoan(summaryRow({ interest_rate: 18, interest_rate_frequency: "annual" }))),
    "18% per year",
  );
  assert.equal(
    activeLoanRateText(mapLoanToActiveLoan(summaryRow({ interest_rate: "3.00", interest_rate_frequency: "monthly" }))),
    "3% per month",
  );
  assert.equal(activeLoanRateText(mapLoanToActiveLoan(summaryRow({ interest_rate: 3 }))), "3% per month");
  assert.equal(activeLoanRateText(mapLoanToActiveLoan(summaryRow())), "—");
});

test("the dialog's Interest reads the rate and the method side by side, with no brackets inside brackets", () => {
  assert.equal(
    activeLoanInterestText(
      mapLoanToActiveLoan(summaryRow({ interest_rate: 3, interest_rate_frequency: "monthly", interest_type: "straight" })),
    ),
    "3% per month · Straight (Fixed)",
  );
  assert.equal(
    activeLoanInterestText(
      mapLoanToActiveLoan(summaryRow({ interest_rate: 18, interest_rate_frequency: "annual", interest_type: "diminishing" })),
    ),
    "18% per year · Diminishing",
  );
  assert.equal(activeLoanInterestText(mapLoanToActiveLoan(summaryRow())), "—");
});

test("an upon-maturity loan reads its own method, as the loan page does, never Straight (Fixed)", () => {
  const byMethod = mapLoanToActiveLoan(
    summaryRow({ interest_rate: 5, interest_rate_frequency: "monthly", interest_method: "upon_maturity", interest_type: "fixed" }),
  );
  assert.equal(byMethod.interest_type, "upon_maturity");
  assert.equal(activeLoanInterestText(byMethod), "5% per month · Upon Maturity");
  const byType = mapLoanToActiveLoan(summaryRow({ interest_rate: 5, interest_type: "upon_maturity" }));
  assert.equal(activeLoanInterestText(byType), "5% per month · Upon Maturity");
  // The legacy spelling "fixed" still reads as straight.
  assert.equal(
    activeLoanInterestText(mapLoanToActiveLoan(summaryRow({ interest_rate: 3, interest_type: "fixed" }))),
    "3% per month · Straight (Fixed)",
  );
  // A loan that didn't send its method shows the rate alone, never a guessed method.
  assert.equal(activeLoanInterestText(mapLoanToActiveLoan(summaryRow({ interest_rate: 3 }))), "3% per month");
});

test("an upon-maturity loan's next due date is its maturity date when the row sends one", () => {
  const loan = mapLoanToActiveLoan(
    summaryRow({ frequency: "upon_maturity", maturity_date: "2027-01-31" }),
  );
  assert.equal(loan.next_due_date, "2027-01-31");
});

test("an upon-maturity summary row without a maturity date reads the server's next due date", () => {
  const loan = mapLoanToActiveLoan(summaryRow({ frequency: "upon_maturity" }));
  assert.equal(loan.next_due_date, "2026-11-30");
});

test("the Due Amount cell prefers the server's amount due now, with its notes", () => {
  const cell = activeLoanDueCell(
    mapLoanToActiveLoan(
      summaryRow({
        amount_due_now: {
          amount: 2100,
          insurance: 50,
          penalty: 100,
          interest: 300,
          principal: 1650,
          share_capital_build_up: 0,
          period_number: 2,
          last_period_number: 2,
          schedule_id: 9,
          as_of: "2026-11-05",
        },
      }),
    ),
  );

  assert.equal(cell.amount, "₱2,100.00");
  assert.equal(cell.penaltyNote, "incl. ₱100.00 penalty");
  assert.equal(cell.insuranceNote, "incl. ₱50.00 premium");
});

test("a summary row's Due Amount is the server's next_due_amount", () => {
  const cell = activeLoanDueCell(mapLoanToActiveLoan(summaryRow()));

  assert.equal(cell.amount, "₱1,833.34");
  assert.equal(cell.penaltyNote, null);
  assert.equal(cell.insuranceNote, null);
});

test("₱0.00 is a figure and shows; only a missing one is a dash", () => {
  assert.equal(activeLoanDueCell(mapLoanToActiveLoan(summaryRow({ next_due_amount: 0 }))).amount, "₱0.00");
  assert.equal(activeLoanDueCell(mapLoanToActiveLoan(summaryRow({ next_due_amount: undefined }))).amount, "—");
});

test("the drain is gone from the module and from the screen", () => {
  assert.equal("fetchAllActiveLoans" in activeLoans, false);
  const page = readFileSync(join(process.cwd(), "src/app/(app)/payments/page.tsx"), "utf8");
  assert.equal(page.includes("fetchAllActiveLoans"), false);
  assert.equal(page.includes("This list is incomplete"), false);
});

test("Due Soon counts Manila's calendar days to the next due date, on any computer", () => {
  const original = process.env.TZ;
  // 07:00 on 10 Nov in Manila: 18:00 the 9th in New York, 12:00 the 10th in Auckland.
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 10, 9, 23, 0) });
  try {
    for (const zone of ["America/New_York", "Pacific/Auckland", "Asia/Manila"]) {
      process.env.TZ = zone;
      assert.equal(activeLoans.isDueSoon("2026-11-13"), true, `3 days ahead, ${zone}`);
      assert.equal(activeLoans.isDueSoon("2026-11-14"), false, `4 days ahead, ${zone}`);
      assert.equal(activeLoans.isDueSoon("2026-11-10"), true, `today, ${zone}`);
      assert.equal(activeLoans.isDueSoon("not a date"), false, zone);
    }
  } finally {
    mock.timers.reset();
    process.env.TZ = original;
  }
});

test("the payments screen asks isDueSoon instead of counting from the computer's clock", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/payments/page.tsx"), "utf8");
  assert.match(page, /isDueSoon\(loan\.next_due_date\)/);
  assert.doesNotMatch(page, /new Date\(loan\.next_due_date\)/);
});

// ── the monthly late penalty's note (backend #284) ─────────────────────────

test("a summary row has no schedule, so no period carries a note and the summary note waits", () => {
  const loan = mapLoanToActiveLoan(summaryRow());
  assert.deepEqual(loan.schedule_penalties, []);
  assert.equal(loan.penalty_note, null);
});

test("the full loan keeps each schedule row's penalty and penalty_months as sent", () => {
  const rows = [
    { id: 71, period_number: 1, penalty_amount: 0, penalty_months: 0, principal_due: 1000 },
    { id: 72, period_number: 2, penalty_amount: 150, penalty_months: 3, principal_due: 1000 },
  ];
  const loan = mapLoanToActiveLoan(summaryRow({ amortization_schedules: rows }));
  assert.deepEqual(loan.schedule_penalties, [
    { id: 71, period_number: 1, penalty_amount: 0, penalty_months: 0 },
    { id: 72, period_number: 2, penalty_amount: 150, penalty_months: 3 },
  ]);
});

test("the loan summary's penalty_months reads as the note, only with a penalty owed", () => {
  const loan = mapLoanToActiveLoan(summaryRow());
  assert.equal(withSummaryPenaltyNote(loan, { penalty_amount: 300, penalty_months: 2 }).penalty_note, "Penalty: 2 months late");
  assert.equal(withSummaryPenaltyNote(loan, { penalty_amount: 100, penalty_months: 1 }).penalty_note, "Penalty: 1 month late");
  assert.equal(withSummaryPenaltyNote(loan, { penalty_amount: 0, penalty_months: 2 }).penalty_note, null);
  assert.equal(withSummaryPenaltyNote(loan, null).penalty_note, null);
});

test("whether the loan carries a Share Capital Build-Up comes from its own scb_amount", () => {
  assert.equal(mapLoanToActiveLoan(summaryRow({ scb_amount: 250 })).has_build_up, true);
  assert.equal(mapLoanToActiveLoan(summaryRow({ scb_amount: "250.00" })).has_build_up, true);
  assert.equal(mapLoanToActiveLoan(summaryRow({ scb_amount: 0 })).has_build_up, false);
  assert.equal(mapLoanToActiveLoan(summaryRow({ scb_amount: "0.00" })).has_build_up, false);
  // A summary row that doesn't say: unknown until the full loan loads.
  assert.equal(mapLoanToActiveLoan(summaryRow()).has_build_up, null);
});

test("a loan's build-up, read from scb_amount wherever the loan is shown", () => {
  assert.equal(loanHasBuildUp(500), true);
  assert.equal(loanHasBuildUp("0.00"), false);
  assert.equal(loanHasBuildUp(undefined), null);
  assert.equal(loanHasBuildUp(null), null);
});
