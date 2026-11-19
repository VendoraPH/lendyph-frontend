import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExecutiveBranches, ExecutiveCard, ExecutiveOverview, ExecutivePeriod } from "@/types/executive-dashboard";
import { type ExecutiveData } from "./executive-data";
import { executiveDocument } from "./executive-export";

const KEYS: (keyof ExecutiveData)[] = [
  "balance", "aging", "cashFlow", "efficiency", "products", "performance",
  "shareCapital", "borrowers", "disbursements", "accounting", "loanStats",
];

function data(overrides: Partial<ExecutiveData> = {}): ExecutiveData {
  return { ...(Object.fromEntries(KEYS.map((k) => [k, { state: "error" }])) as unknown as ExecutiveData), ...overrides };
}

const PERIOD: ExecutivePeriod = {
  preset: "this_month",
  label: "This Month",
  from: "2026-11-01",
  to: "2026-11-17",
  days: 17,
  previous: { from: "2026-10-01", to: "2026-10-17", days: 17 },
  as_of: "2026-11-17",
};

const card = (key: string, over: Partial<ExecutiveCard> = {}): ExecutiveCard => ({
  key,
  label: key,
  unit: "money",
  value: 1500000,
  previous_value: 1000000,
  change: 50,
  change_unit: "percent",
  as_of: "2026-11-17",
  previous_as_of: "2026-10-17",
  state: "ready",
  filters_applied: [],
  details: {},
  ...over,
});

const OVERVIEW: ExecutiveOverview = {
  period: PERIOD,
  generated_at: "2026-11-17 09:00:00",
  filters_applied: [],
  cards: {
    gross_loan_portfolio: card("gross_loan_portfolio", { label: "Gross Loan Portfolio" }),
    past_due_amount: card("past_due_amount", { label: "Past Due Amount", state: "no_snapshot", value: null }),
    net_income: card("net_income", { label: "Net Income", state: "no_access", value: null }),
  },
};

const BRANCHES: ExecutiveBranches = {
  period: PERIOD,
  filters_applied: {},
  generated_at: "2026-11-17 09:00:00",
  balances_as_of: "2026-11-17",
  books_state: "no_access",
  rows: [
    {
      branch_id: 1,
      branch_name: "Main",
      gross_loan_portfolio: 100,
      total_outstanding: 120,
      active_loans: 7,
      past_due_amount: 10,
      past_due_loans: 1,
      par_30: { amount: 10, ratio: 10, loans: 1 },
      loans_released: 50,
      collections: 40,
      collected_insurance: 2,
      collection_efficiency: 90,
      revenue: null,
      expenses: null,
      net: null,
    },
  ],
  totals: {
    gross_loan_portfolio: 555.55,
    total_outstanding: 120,
    active_loans: 7,
    past_due_amount: 10,
    past_due_loans: 1,
    par_30: { amount: 10, ratio: 10, loans: 1 },
    loans_released: 50,
    collections: 40,
    collected_insurance: 2,
    collection_efficiency: 90,
    revenue: null,
    expenses: null,
    net: null,
  },
};

test("the export is an executive_dashboard document led by the server's cards, in words", () => {
  const doc = executiveDocument({ data: data(), overview: OVERVIEW, branches: BRANCHES, attention: null, sentFilters: [], period: PERIOD }, new Date(2026, 10, 17, 9, 0));
  assert.equal(doc.reportId, "executive_dashboard");
  assert.equal(doc.meta.period, "Nov 1, 2026 – Nov 17, 2026");
  const grid = doc.sections[0];
  if (grid.kind !== "kpi_grid") throw new Error("expected the KPI grid first");
  const byLabel = Object.fromEntries(grid.items.map((i) => [i.label, i]));
  assert.equal(byLabel["Gross Loan Portfolio"].value, "₱1,500,000.00");
  assert.equal(byLabel["Gross Loan Portfolio"].hint, "As of Nov 17, 2026 · +50.0% against the previous period");
  assert.equal(byLabel["Past Due Amount"].value, "No snapshot for this date");
  assert.equal("Net Income" in byLabel, false);
});

test("without the overview, the export says the cards could not be read", () => {
  const doc = executiveDocument({ data: data(), overview: null, branches: null, attention: null, sentFilters: [], period: PERIOD });
  const grid = doc.sections[0];
  if (grid.kind !== "kpi_grid") throw new Error("expected the KPI grid first");
  assert.deepEqual(grid.items, []);
});

test("the branch table is the server's rows and totals, never a sum", () => {
  const doc = executiveDocument({ data: data(), overview: OVERVIEW, branches: BRANCHES, attention: null, sentFilters: [], period: PERIOD });
  const table = doc.sections.find((s) => s.kind === "table" && s.title === "Branch Performance");
  if (!table || table.kind !== "table") throw new Error("expected the branch table");
  assert.deepEqual(table.columns.map((c) => c.header).slice(0, 4), ["Branch", "Gross Loan Portfolio", "Outstanding", "Active Loans"]);
  assert.equal(table.columns.some((c) => c.header === "Revenue"), false);
  assert.equal(table.rows[0].gross_loan_portfolio, "₱100.00");
  assert.equal(table.rows.at(-1)?.name, "Total");
  assert.equal(table.rows.at(-1)?.gross_loan_portfolio, "₱555.55");
});

test("the export's other tables carry the screen's columns and dates in words", () => {
  const doc = executiveDocument({
    data: data({ aging: { state: "ready", data: { buckets: { "1_30": { amount: "50", count: 2 } } } } }),
    overview: OVERVIEW,
    branches: BRANCHES,
    attention: null,
    sentFilters: [],
    period: PERIOD,
  });
  const tables = doc.sections.filter((s) => s.kind === "table");
  const aging = tables.find((t) => t.title?.startsWith("Past Due Aging"));
  assert.equal(aging?.title, "Past Due Aging (as of Nov 17, 2026)");
  const products = tables.find((t) => t.title?.startsWith("Portfolio by Product"));
  assert.deepEqual(products?.columns.map((c) => c.header), ["Product", "Loans", "Outstanding", "Principal Balance", "Share of portfolio", "PAR 30"]);
});

test("Requires Attention exports the server's rules in words, and says when they couldn't be read", () => {
  const attention = {
    period: PERIOD,
    as_of: "2026-11-17",
    thresholds: {},
    rules: [
      { key: "approval_wait", label: "Loans waiting for approval", rule: null, threshold: 3, link: "/loans", state: "needs_attention" as const, value: 2, title: "2 loans waiting for approval for more than 3 days", detail: "5 loans waiting for approval in all.", as_of: "2026-11-17" },
    ],
    alerts: [],
    filters_applied: [],
    filters_applied_to: {},
  };
  const doc = executiveDocument({ data: data(), overview: OVERVIEW, branches: BRANCHES, attention, sentFilters: [], period: PERIOD });
  const table = doc.sections.find((s) => s.kind === "table" && s.title === "Requires Attention");
  if (!table || table.kind !== "table") throw new Error("expected the attention table");
  assert.deepEqual(table.rows[0], {
    state: "Needs attention",
    title: "Loans waiting for approval: 2 loans waiting for approval for more than 3 days",
    detail: "5 loans waiting for approval in all. As of Nov 17, 2026",
  });
  const missing = executiveDocument({ data: data(), overview: OVERVIEW, branches: BRANCHES, attention: null, sentFilters: [], period: PERIOD });
  const none = missing.sections.find((s) => s.kind === "table" && s.title === "Requires Attention");
  assert.equal(none?.kind === "table" ? none.emptyText : null, "Not available: the checks couldn't be read.");
});
