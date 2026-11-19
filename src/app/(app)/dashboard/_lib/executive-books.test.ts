import test from "node:test";
import assert from "node:assert/strict";

import type { AccountingDashboard } from "@/types/accounting";
import type { ExecutiveAttention, ExecutiveFilterKey, ExecutivePeriod, ExecutiveTurnaround, FiltersAppliedTo, ShareCapitalControl } from "@/types/executive-dashboard";
import { attentionView, ATTENTION_STATE_TEXT } from "./attention";
import { booksParams } from "@/services/executive-dashboard.service";
import { SECTION_FILTERS, reportFigureNote, sectionFilterNote, figureFilterNote, financialBooks, shareCapitalControlTable, trendSeries, turnaroundRows } from "./executive-books";
import { cardFilterNote, executiveQuery, sentFilters } from "./executive-overview";

const period: ExecutivePeriod = {
  preset: "this_month",
  label: "This Month",
  from: "2026-11-01",
  to: "2026-11-19",
  days: 19,
  previous: { from: "2026-10-01", to: "2026-10-19", days: 19 },
  as_of: "2026-11-19",
};

// ── Filters ────────────────────────────────────────────────────────────────

test("the page filters go with the period and branch to every endpoint", () => {
  assert.deepEqual(executiveQuery({ preset: "this_month" }, 2, { product_id: 5, officer_id: 9, collector_id: 11 }), {
    preset: "this_month",
    branch_id: 2,
    product_id: 5,
    officer_id: 9,
    collector_id: 11,
  });
  assert.deepEqual(executiveQuery({ preset: "this_month" }, undefined, {}), { preset: "this_month" });
  assert.deepEqual(sentFilters({ preset: "today", product_id: 5, collector_id: 1 }), ["product_id", "collector_id"]);
});

test("EB-D2's endpoints take a custom range as from and to", () => {
  assert.deepEqual(booksParams({ preset: "custom", date_from: "2026-10-01", date_to: "2026-10-31", officer_id: 3 }), {
    preset: "custom",
    from: "2026-10-01",
    to: "2026-10-31",
    officer_id: 3,
  });
  assert.deepEqual(booksParams({ preset: "last_month", branch_id: 1 }), { preset: "last_month", branch_id: 1 });
});

test("a figure that a sent filter doesn't follow says so, from filters_applied_to", () => {
  const response: FiltersAppliedTo = { filters_applied: [], filters_applied_to: { product_id: ["cash_in"], collector_id: ["cash_in"] } };
  assert.equal(figureFilterNote(["product_id"], response, "cash_in"), null);
  assert.equal(
    figureFilterNote(["product_id", "collector_id"], response, "new_members"),
    "Covers every product and collector: this figure doesn't follow those filters.",
  );
  assert.equal(figureFilterNote(["officer_id"], { filters_applied: ["officer_id"], filters_applied_to: {} }, "x"), null);
});

// ── Requires Attention ─────────────────────────────────────────────────────

function attention(rules: Partial<ExecutiveAttention["rules"][number]>[], over: Partial<ExecutiveAttention> = {}): ExecutiveAttention {
  const full = rules.map((r, i) => ({
    key: `rule_${i}`,
    label: `Rule ${i}`,
    rule: null,
    threshold: null,
    link: "/loans",
    state: "clear" as const,
    value: null,
    title: "Title",
    detail: "Detail",
    as_of: "2026-11-19",
    ...r,
  }));
  return {
    period,
    as_of: "2026-11-19",
    thresholds: {},
    rules: full,
    alerts: full.filter((r) => r.state === "needs_attention"),
    filters_applied: [],
    filters_applied_to: {},
    ...over,
  };
}

test("each rule state reads in words", () => {
  assert.deepEqual(ATTENTION_STATE_TEXT, {
    needs_attention: "Needs attention",
    clear: "Clear",
    no_access: "Not available",
    no_data: "No data",
    no_snapshot: "No snapshot for this date",
    requires_configuration: "Requires configuration",
  });
});

test("rules needing attention come first, with the server's title, detail and link", () => {
  const view = attentionView(
    attention([
      { key: "overdue_share", state: "clear", title: "Past due is 2.00% of the outstanding balance" },
      { key: "par30_rise", state: "needs_attention", title: "PAR 30 is 7.5% today, 5% on Nov 12, 2026", link: "/loans/past-due" },
      { key: "control_difference", state: "requires_configuration", title: "Requires configuration", detail: "The opening balances have not been finalised yet." },
    ]),
    [],
  );
  assert.equal(view.count, 1);
  assert.deepEqual(view.rows.map((r) => [r.key, r.stateText, r.tone]), [
    ["par30_rise", "Needs attention", "attention"],
    ["control_difference", "Requires configuration", "neutral"],
    ["overdue_share", "Clear", "clear"],
  ]);
  assert.equal(view.rows[0].title, "PAR 30 is 7.5% today, 5% on Nov 12, 2026");
  assert.equal(view.rows[0].href, "/loans/past-due");
});

test("each rule says which period or as-of date it reads", () => {
  const view = attentionView(
    attention([
      { key: "collection_efficiency", state: "clear" },
      { key: "approval_wait", state: "clear", as_of: "2026-11-19" },
    ]),
    [],
  );
  assert.equal(view.rows.find((r) => r.key === "collection_efficiency")!.basis, "For Nov 1, 2026 – Nov 19, 2026");
  assert.equal(view.rows.find((r) => r.key === "approval_wait")!.basis, "As of Nov 19, 2026");
});

test("a rule the caller can't read is shown as Not available, without figures", () => {
  const view = attentionView(attention([{ key: "control_difference", state: "no_access", detail: "Your role can't view the figures behind this check." }]), []);
  assert.equal(view.rows[0].stateText, "Not available");
  assert.equal(view.rows[0].href, null);
});

test("a rule that ignores a sent filter says so", () => {
  const view = attentionView(
    attention([{ key: "par30_rise" }, { key: "control_difference" }], { filters_applied_to: { product_id: ["par30_rise"] } }),
    ["product_id"],
  );
  assert.equal(view.rows.find((r) => r.key === "par30_rise")!.filterNote, null);
  assert.equal(
    view.rows.find((r) => r.key === "control_difference")!.filterNote,
    "Covers every product: this figure doesn't follow the product filter.",
  );
});

// ── Financial section ──────────────────────────────────────────────────────

function accounting(over: Partial<AccountingDashboard> = {}): AccountingDashboard {
  return {
    as_of: "2026-11-19",
    books_state: { state: "ready", label: "Ready", reason: null },
    cash_total: 1234567,
    total_assets: 5000000,
    total_equity: 2500000,
    period: { from: "2026-11-01", to: "2026-11-19", income: 300000, expenses: 100000, net_income: 200000, interest_income: 150050, penalty_income: 2500, fee_income: 0 },
    ...over,
  } as AccountingDashboard;
}

test("ready books read the server's figures, ₱ with two decimals, cash from cash_total", () => {
  const books = financialBooks(accounting());
  assert.equal(books.state, "ready");
  assert.equal(books.notice, null);
  assert.deepEqual(Object.fromEntries(books.figures.map((f) => [f.label, f.value])), {
    "Income (period)": "₱3,000.00",
    "Expenses (period)": "₱1,000.00",
    "Net income (period)": "₱2,000.00",
    "Interest income (cash basis)": "₱1,500.50",
    "Penalty income": "₱25.00",
    "Fee income": "₱0.00",
    "Cash balance": "₱12,345.67",
    "Total assets": "₱50,000.00",
    "Total equity": "₱25,000.00",
  });
});

test("books that aren't ready say so in the server's words, never ₱0.00", () => {
  const books = financialBooks(
    accounting({ books_state: { state: "requires_configuration", label: "Requires configuration", reason: "The opening balances have not been finalised yet." }, cash_total: null }),
  );
  assert.equal(books.state, "requires_configuration");
  assert.equal(books.notice, "Requires configuration: The opening balances have not been finalised yet.");
  assert.deepEqual(books.figures, []);
});

test("a figure the server didn't send reads a dash, never ₱0.00", () => {
  const books = financialBooks(accounting({ cash_total: null, period: { from: "", to: "", income: 1, expenses: 1, net_income: 0 } }));
  const byLabel = Object.fromEntries(books.figures.map((f) => [f.label, f.value]));
  assert.equal(byLabel["Cash balance"], "—");
  assert.equal(byLabel["Interest income (cash basis)"], "—");
});

// ── Trends, turnaround and the share capital control ────────────────────────

test("trend points are the server's months, labelled in words", () => {
  const points = trendSeries([
    { month: "2026-10", from: "2026-10-01", to: "2026-10-31", principal_released: 500, principal_collected: 300, cash_in: 800, cash_out: 600, net_cash: 200, new_members: 4 },
  ]);
  assert.deepEqual(points, [
    { month: "2026-10", label: "Oct 2026", principal_released: 500, principal_collected: 300, cash_in: 800, cash_out: 600, net_cash: 200, new_members: 4 },
  ]);
});

test("turnaround reads days to one decimal, a dash when nothing was measured", () => {
  const data = {
    period,
    submitted_to_approved: { loans: 4, average_days: 2.5, median_days: 2, not_measured: 1 },
    approved_to_released: { loans: 0, average_days: null, median_days: null, not_measured: 0 },
    submitted_to_released: { loans: 3, average_days: 6.25, median_days: 5.5, not_measured: 0 },
    filters_applied: [],
    filters_applied_to: {},
  } satisfies ExecutiveTurnaround;
  assert.deepEqual(turnaroundRows(data), [
    { key: "submitted_to_approved", label: "Submitted to approved", average: "2.5 days", median: "2.0 days", loans: "4", note: "1 loan had no start to measure from." },
    { key: "approved_to_released", label: "Approved to released", average: "—", median: "—", loans: "0", note: null },
    { key: "submitted_to_released", label: "Submitted to released", average: "6.3 days", median: "5.5 days", loans: "3", note: null },
  ]);
});

test("the share capital control reads the server's centavos as ₱, and its reconciled state in words", () => {
  const control: ShareCapitalControl = {
    as_of: "2026-11-19",
    books_state: { state: "ready", label: "Ready", reason: null },
    account: { id: 1, code: "3060", name: "Share Capital" },
    rows: [
      { branch_id: 1, branch_name: "Main", subledger: 150000, books: 150000, difference: 0, is_reconciled: true },
      { branch_id: null, branch_name: "No branch", subledger: 0, books: 2500, difference: 2500, is_reconciled: false },
    ],
    // Deliberately not the rows' sum: the totals are the server's.
    totals: { subledger: 999, books: 152500, difference: 2500, is_reconciled: false },
    is_reconciled: false,
  };
  const table = shareCapitalControlTable(control);
  assert.equal(table.notice, null);
  assert.equal(table.account, "3060 Share Capital");
  assert.deepEqual(table.rows[0], { key: "1", name: "Main", subledger: "₱1,500.00", books: "₱1,500.00", difference: "₱0.00", status: "Agrees" });
  assert.equal(table.rows[1].status, "Differs");
  assert.equal(table.totals.subledger, "₱9.99");
  assert.equal(table.summary, "The subledger and account 3060 differ by ₱25.00 as of Nov 19, 2026.");
});

test("the share capital control waits for the books in the server's words", () => {
  const table = shareCapitalControlTable({
    as_of: "2026-11-19",
    books_state: { state: "requires_configuration", label: "Requires configuration", reason: "The opening balances have not been finalised yet." },
    account: null,
    rows: [{ branch_id: 1, branch_name: "Main", subledger: 150000, books: null, difference: null, is_reconciled: null }],
    totals: { subledger: 150000, books: null, difference: null, is_reconciled: null },
    is_reconciled: null,
  });
  assert.equal(table.notice, "Requires configuration: The opening balances have not been finalised yet.");
  assert.equal(table.rows[0].books, "—");
  assert.equal(table.rows[0].status, "Not compared");
});

// ── Check E7 ───────────────────────────────────────────────────────────────

test("rules that can't be judged come between those needing attention and the clear ones", () => {
  const view = attentionView(
    attention([
      { key: "a", state: "clear" },
      { key: "b", state: "requires_configuration" },
      { key: "c", state: "clear" },
      { key: "d", state: "needs_attention" },
      { key: "e", state: "no_access" },
      { key: "f", state: "no_data" },
      { key: "g", state: "no_snapshot" },
    ]),
    [],
  );
  assert.deepEqual(view.rows.map((r) => r.key), ["d", "b", "e", "f", "g", "a", "c"]);
});

test("Share Capital Control, which sends no filter list, ignores every page filter", () => {
  assert.deepEqual(SECTION_FILTERS.shareCapitalControl, []);
  assert.equal(
    sectionFilterNote(["product_id", "officer_id", "collector_id"], "shareCapitalControl"),
    "Covers every product, loan officer and collector: this figure doesn't follow those filters.",
  );
  assert.equal(sectionFilterNote([], "shareCapitalControl"), null);
});

test("a figure that repeats an overview card takes the card's own filter list", () => {
  const overview = {
    period,
    generated_at: "2026-11-19 09:00:00",
    filters_applied: ["product_id", "collector_id"] as const,
    cards: {
      share_capital: { key: "share_capital", label: "Share Capital", unit: "money", value: 1, previous_value: null, change: null, change_unit: "percent", as_of: null, previous_as_of: null, state: "ready", filters_applied: [], details: {} },
    },
  } as unknown as Parameters<typeof cardFilterNote>[0];
  assert.equal(cardFilterNote(overview, "share_capital"), "Covers every product and collector: this figure doesn't follow those filters.");
  assert.equal(cardFilterNote(overview, "missing"), null);
  assert.equal(cardFilterNote(null, "share_capital"), null);
});

// ── Check E8 ───────────────────────────────────────────────────────────────

test("each report figure gets its own note, from the report's filter list", () => {
  const disbursements: FiltersAppliedTo = { filters_applied: ["product_id", "officer_id"], filters_applied_to: {} };
  const members: FiltersAppliedTo = { filters_applied: [], filters_applied_to: {} };
  const performance: FiltersAppliedTo = { filters_applied: ["product_id"], filters_applied_to: { collector_id: ["by_officer.collected"] } };
  const sent: ExecutiveFilterKey[] = ["product_id", "collector_id"];
  assert.equal(
    reportFigureNote(sent, disbursements, "pending_release", []),
    "Covers every collector: this figure doesn't follow the collector filter.",
  );
  assert.equal(
    reportFigureNote(sent, members, "total_active_borrowers", []),
    "Covers every product and collector: this figure doesn't follow those filters.",
  );
  // A path covers what sits under it.
  assert.equal(reportFigureNote(sent, performance, "by_officer.collected", []), null);
  assert.equal(
    reportFigureNote(sent, performance, "by_officer.total_outstanding", []),
    "Covers every collector: this figure doesn't follow the collector filter.",
  );
});

test("a report that sends no filter list falls back to the figure's known filters", () => {
  assert.equal(reportFigureNote(["officer_id"], {}, "pending_release", ["officer_id"]), null);
  assert.equal(
    reportFigureNote(["product_id"], null, "pending_release", ["officer_id"]),
    "Covers every product: this figure doesn't follow the product filter.",
  );
});
