import test from "node:test";
import assert from "node:assert/strict";

import {
  EXECUTIVE_PRESETS,
  booksState,
  branchTable,
  balanceHeading,
  captionText,
  cardFigureText,
  cardViews,
  isPastPeriod,
  rangeProblem,
  executiveQuery,
  ignoredFilterNote,
  parLoanRows,
  periodCaption,
  updatedText,
} from "./executive-overview";
import type { ExecutiveBranches, ExecutiveCard, ExecutiveOverview, ExecutivePeriod, ParLoansPage } from "@/types/executive-dashboard";

const period: ExecutivePeriod = {
  preset: "this_month",
  label: "This Month",
  from: "2026-11-01",
  to: "2026-11-19",
  days: 19,
  previous: { from: "2026-10-01", to: "2026-10-19", days: 19 },
  as_of: "2026-11-19",
};

function card(over: Partial<ExecutiveCard> & { key: string }): ExecutiveCard {
  return {
    label: over.key,
    unit: "money",
    value: null,
    previous_value: null,
    change: null,
    change_unit: "percent",
    as_of: "2026-11-19",
    previous_as_of: null,
    state: "ready",
    filters_applied: [],
    details: {},
    ...over,
  };
}

function overview(cards: ExecutiveCard[], filters: ExecutiveOverview["filters_applied"] = []): ExecutiveOverview {
  return { period, generated_at: "2026-11-19 09:30:00", filters_applied: filters, cards: Object.fromEntries(cards.map((c) => [c.key, c])) };
}

// ── Cards ─────────────────────────────────────────────────────────────────

test("a ready card shows the server's value, previous value, change and as-of date", () => {
  const [view] = cardViews(
    overview([
      card({
        key: "collections",
        label: "Collections",
        value: 1_250_000.5,
        previous_value: 1_000_000,
        change: 25,
        previous_as_of: "2026-10-19",
      }),
    ]),
  );
  assert.equal(view.state, "ready");
  assert.equal(view.label, "Collections");
  assert.equal(view.valueText, "₱1,250,000.50");
  assert.equal(view.compactText, "₱1.3M");
  assert.equal(view.changeText, "+25.0%");
  assert.equal(view.changeTone, "good");
  assert.equal(view.previousText, "Previous: ₱1,000,000.00 (Oct 19, 2026)");
  assert.equal(view.asOfText, "Through Nov 19, 2026");
});

test("the change is the server's, never worked out from value and previous", () => {
  const [view] = cardViews(overview([card({ key: "loans_released", value: 300, previous_value: 100, change: 12.34 })]));
  assert.equal(view.changeText, "+12.3%");
});

test("a ratio's change reads in points; a rise in PAR or past due is bad news", () => {
  const [par] = cardViews(
    overview([card({ key: "par_30", unit: "percent", value: 6.5, previous_value: 5, change: 1.5, change_unit: "points" })]),
  );
  assert.equal(par.valueText, "6.50%");
  assert.equal(par.changeText, "+1.50 pts");
  assert.equal(par.changeTone, "bad");
  assert.equal(par.asOfText, "As of Nov 19, 2026");
});

test("no change reads nothing, never 0%", () => {
  const [view] = cardViews(overview([card({ key: "collections", value: 10, previous_value: 0, change: null })]));
  assert.equal(view.changeText, null);
});

test("a past day with no snapshot says so", () => {
  const [view] = cardViews(overview([card({ key: "gross_loan_portfolio", state: "no_snapshot", previous_value: 900 })]));
  assert.equal(view.state, "no_snapshot");
  assert.equal(view.valueText, "No snapshot for this date");
  assert.equal(view.compactText, "No snapshot for this date");
  assert.equal(view.changeText, null);
});

test("books that aren't set up read Requires configuration", () => {
  const [view] = cardViews(overview([card({ key: "interest_income", state: "requires_configuration" })]));
  assert.equal(view.valueText, "Requires configuration");
});

test("a card the caller may not see is left out", () => {
  const views = cardViews(
    overview([card({ key: "collections", value: 5 }), card({ key: "net_income", state: "no_access" })]),
  );
  assert.deepEqual(
    views.map((v) => v.key),
    ["collections"],
  );
});

test("cards keep the server's order", () => {
  const views = cardViews(overview([card({ key: "b_card", value: 1 }), card({ key: "a_card", value: 2 })]));
  assert.deepEqual(
    views.map((v) => v.key),
    ["b_card", "a_card"],
  );
});

test("share capital compares with its opening balance", () => {
  const [view] = cardViews(overview([card({ key: "share_capital", value: 200, previous_value: 100, change: 100 })]));
  assert.equal(view.changeBasis, "against the opening balance");
  const [other] = cardViews(overview([card({ key: "collections", value: 200, previous_value: 100, change: 100 })]));
  assert.equal(other.changeBasis, "against the previous period");
});

// ── Filter notes ───────────────────────────────────────────────────────────

test("a filter a figure ignores is said in words", () => {
  assert.equal(ignoredFilterNote(["product_id"], ["product_id"]), null);
  assert.equal(ignoredFilterNote(["product_id"], []), "Covers every product: this figure doesn't follow the product filter.");
  assert.equal(
    ignoredFilterNote(["product_id", "officer_id", "collector_id"], ["product_id"]),
    "Covers every loan officer and collector: this figure doesn't follow those filters.",
  );
  assert.equal(ignoredFilterNote([], []), null);
});

test("a card's note comes from the filters sent less the ones it followed", () => {
  const [view] = cardViews(overview([card({ key: "share_capital", value: 1, filters_applied: [] })], ["product_id"]));
  assert.equal(view.filterNote, "Covers every product: this figure doesn't follow the product filter.");
});

// ── Periods ────────────────────────────────────────────────────────────────

test("presets are the server's, with Last 7 Days and Last 30 Days, not weeks", () => {
  assert.deepEqual(
    EXECUTIVE_PRESETS.map((p) => p.id),
    ["today", "yesterday", "last_7_days", "last_30_days", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "custom"],
  );
});

test("a preset sends only its name; the server works out the dates in Manila", () => {
  assert.deepEqual(executiveQuery({ preset: "last_30_days" }, undefined), { preset: "last_30_days" });
  assert.deepEqual(executiveQuery({ preset: "this_month", from: "2026-01-01", to: "2026-01-31" }, 4), {
    preset: "this_month",
    branch_id: 4,
  });
});

test("a custom range sends its two dates as typed", () => {
  assert.deepEqual(executiveQuery({ preset: "custom", from: "2026-10-01", to: "2026-10-15" }, undefined), {
    preset: "custom",
    date_from: "2026-10-01",
    date_to: "2026-10-15",
  });
});

test("the caption reads the server's period and its comparison", () => {
  assert.equal(periodCaption(period), "This Month: Nov 1, 2026 – Nov 19, 2026, compared with Oct 1, 2026 – Oct 19, 2026");
});

test("Updated reads the server's time in Manila", () => {
  assert.equal(updatedText("2026-11-19 09:30:00"), "Updated Nov 19, 2026, 09:30 AM");
});

// ── Branch table ───────────────────────────────────────────────────────────

function branchRow(id: number | null, name: string, over: Record<string, unknown> = {}) {
  return {
    branch_id: id,
    branch_name: name,
    gross_loan_portfolio: 100,
    total_outstanding: 120,
    active_loans: 3,
    past_due_amount: 10,
    past_due_loans: 1,
    par_30: { amount: 10, ratio: 8.33, loans: 1 },
    loans_released: 50,
    collections: 40,
    collected_insurance: 2,
    collection_efficiency: 91.5,
    revenue: 30,
    expenses: 20,
    net: 10,
    ...over,
  };
}

function branches(over: Partial<ExecutiveBranches> = {}): ExecutiveBranches {
  return {
    period,
    filters_applied: { gross_loan_portfolio: ["product_id"], revenue: [] },
    generated_at: "2026-11-19 09:30:00",
    balances_as_of: "2026-11-19",
    books_state: "ready",
    rows: [branchRow(1, "Main"), branchRow(2, "North")],
    // Deliberately not the rows' sum: the totals are the server's.
    totals: { ...branchRow(null, ""), gross_loan_portfolio: 999.99, par_30: { amount: 1, ratio: 7.77, loans: 2 } },
    ...over,
  };
}

test("branch rows read the server's figures in words, ₱ with two decimals", () => {
  const table = branchTable(branches(), ["product_id"]);
  assert.deepEqual(table.rows[0].cells.gross_loan_portfolio, "₱100.00");
  assert.equal(table.rows[0].cells.par_30, "8.33%");
  assert.equal(table.rows[0].cells.collection_efficiency, "91.50%");
  assert.equal(table.rows[0].cells.active_loans, "3");
  assert.equal(table.rows[0].name, "Main");
});

test("the totals row is the server's totals, never a sum of the rows", () => {
  const table = branchTable(branches(), []);
  assert.equal(table.totals.gross_loan_portfolio, "₱999.99");
  assert.equal(table.totals.par_30, "7.77%");
});

test("a No branch row shows only when the server sends it, and its lending figures read a dash", () => {
  assert.equal(branchTable(branches(), []).rows.some((r) => r.name === "No branch"), false);
  const withNone = branchTable(
    branches({
      rows: [
        branchRow(1, "Main"),
        branchRow(null, "No branch", { gross_loan_portfolio: null, par_30: null, collection_efficiency: null }),
      ],
    }),
    [],
  );
  const none = withNone.rows.at(-1)!;
  assert.equal(none.name, "No branch");
  assert.equal(none.cells.gross_loan_portfolio, "—");
  assert.equal(none.cells.par_30, "—");
  assert.equal(none.cells.revenue, "₱30.00");
});

test("the books columns show only while the books are ready", () => {
  assert.equal(branchTable(branches(), []).columns.some((c) => c.key === "revenue"), true);
  const noAccess = branchTable(branches({ books_state: "no_access" }), []);
  assert.equal(noAccess.columns.some((c) => c.key === "revenue"), false);
  assert.equal(noAccess.booksNote, null);
  const notSetUp = branchTable(branches({ books_state: "requires_configuration" }), []);
  assert.equal(notSetUp.booksNote, "Revenue, expenses and net: Requires configuration.");
});

test("each column says which sent filter it ignores", () => {
  const table = branchTable(branches(), ["product_id"]);
  assert.equal(table.columns.find((c) => c.key === "gross_loan_portfolio")!.note, null);
  assert.equal(
    table.columns.find((c) => c.key === "revenue")!.note,
    "Covers every product: this figure doesn't follow the product filter.",
  );
});

test("the table says when its figures were worked out and how its balances are dated", () => {
  const table = branchTable(branches(), []);
  assert.equal(table.updated, "Updated Nov 19, 2026, 09:30 AM");
  assert.equal(table.balancesNote, "Balances are as of Nov 19, 2026; released, collections and efficiency cover the period.");
});

// ── PAR drill-down ─────────────────────────────────────────────────────────

test("PAR loans read the member by name and code only, with the server's figures", () => {
  const page: ParLoansPage = {
    data: [
      {
        loan_id: 7,
        account_number: "LN-000007",
        member: { id: 3, name: "Ana Reyes", code: "BRW-0003" },
        branch: { id: 1, name: "Main" },
        product: { id: 2, name: "Salary Loan" },
        display_status: "past_due",
        oldest_unpaid_due_date: "2026-09-15",
        days_past_due: 65,
        outstanding_principal: 12000,
        past_due_amount: 3500.25,
        total_outstanding: 14000,
      },
    ],
    meta: {
      par: "par_30",
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: 1,
      totals: { loans: 1, outstanding_principal: 12000 },
      filters_applied: [],
    },
  };
  assert.deepEqual(parLoanRows(page), [
    {
      key: 7,
      href: "/loans/7",
      account: "LN-000007",
      member: "Ana Reyes (BRW-0003)",
      branch: "Main",
      product: "Salary Loan",
      oldestDue: "Sep 15, 2026",
      daysPastDue: "65",
      principal: "₱12,000.00",
      pastDue: "₱3,500.25",
      outstanding: "₱14,000.00",
    },
  ]);
});

// ── Browser check E4 ───────────────────────────────────────────────────────

test("a ready balance card with no previous value says why, never a blank", () => {
  const [view] = cardViews(overview([card({ key: "gross_loan_portfolio", value: 100, previous_value: null })]));
  assert.equal(view.previousText, "No comparison: no snapshot for the earlier date");
  assert.equal(view.changeText, null);
});

test("the server's previous_state is used when it sends one", () => {
  const [snap] = cardViews(
    overview([card({ key: "collections", value: 100, previous_value: null, previous_state: "no_snapshot" })]),
  );
  assert.equal(snap.previousText, "No comparison: no snapshot for the earlier date");
  const [none] = cardViews(overview([card({ key: "collections", value: 100, previous_value: null })]));
  assert.equal(none.previousText, "No comparison for the earlier period");
});

test("a past period is one that ends before the server's today", () => {
  assert.equal(isPastPeriod({ ...period, to: "2026-10-31" }, "2026-11-19"), true);
  assert.equal(isPastPeriod(period, "2026-11-19"), false);
});

test("the caption reads the server's refusal instead of waiting forever", () => {
  assert.equal(captionText(period, null), periodCaption(period));
  assert.equal(captionText(null, null), "Working out the period…");
  assert.equal(captionText(null, "The end date can't be after today."), "Period not available: The end date can't be after today.");
});

test("the books read Requires configuration when the overview's book cards say so", () => {
  assert.equal(booksState(overview([card({ key: "net_income", state: "requires_configuration" })])), "requires_configuration");
  assert.equal(booksState(overview([card({ key: "net_income", value: 5 })])), "ready");
  assert.equal(booksState(overview([card({ key: "net_income", state: "no_access" })])), "ready");
  assert.equal(booksState(null), "ready");
});

test("a custom range missing a date asks for it, and sends nothing", () => {
  assert.equal(rangeProblem({ preset: "custom", from: "2026-11-20", to: undefined }), "Choose an end date");
  assert.equal(rangeProblem({ preset: "custom", from: undefined, to: "2026-11-20" }), "Choose a start date");
  assert.equal(rangeProblem({ preset: "custom", from: "2026-11-01", to: "2026-11-20" }), null);
  assert.equal(rangeProblem({ preset: "this_month" }), null);
});

// ── Re-check E5 ────────────────────────────────────────────────────────────

test("Required Allowance anywhere on the dashboard is the overview card's figure", () => {
  const o = overview([card({ key: "required_allowance", value: 45037.5 })]);
  assert.equal(cardFigureText(o, "required_allowance"), "₱45,037.50");
  assert.equal(cardFigureText(overview([card({ key: "required_allowance", state: "no_snapshot" })]), "required_allowance"), "No snapshot for this date");
  assert.equal(cardFigureText(overview([card({ key: "required_allowance", state: "no_access" })]), "required_allowance"), "Not available");
  assert.equal(cardFigureText(null, "required_allowance"), "—");
});

test("a balance heading says as of today only while it shows today's figures", () => {
  assert.equal(balanceHeading("Past due aging", false), "Past due aging (as of today)");
  assert.equal(balanceHeading("Past due aging", true), "Past due aging");
});

test("the branch table groups its columns: balances as of the server's date, then the period", () => {
  const table = branchTable(branches({ balances_as_of: "2026-11-19" }), []);
  assert.deepEqual(table.groups, [
    { label: "Balances as of Nov 19, 2026", span: 5 },
    { label: "For the period", span: 3 },
    { label: "Books, for the period", span: 3 },
  ]);
  assert.deepEqual(branchTable(branches({ books_state: "no_access" }), []).groups.map((g) => g.span), [5, 3]);
});
