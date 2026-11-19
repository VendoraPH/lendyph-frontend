import { test } from "node:test";
import assert from "node:assert/strict";
import { LOADING, type ExecutiveData } from "./executive-data";
import { executiveDocument } from "./executive-export";
import { DATA_UNAVAILABLE } from "./metrics";

const KEYS: (keyof ExecutiveData)[] = [
  "balance", "aging", "cashFlow", "prevCashFlow", "efficiency", "prevEfficiency", "products", "performance",
  "provisioning", "shareCapital", "income", "borrowers", "disbursements", "accounting", "loanStats",
  "pastDue",
];

function data(overrides: Partial<ExecutiveData> = {}): ExecutiveData {
  return { ...(Object.fromEntries(KEYS.map((k) => [k, { state: "error" }])) as unknown as ExecutiveData), ...overrides };
}

const PERIOD = { from: "2026-11-01", to: "2026-11-17" };

test("the export is an executive_dashboard document led by the 12 overview figures", () => {
  const doc = executiveDocument(data(), PERIOD, new Date(2026, 10, 17, 9, 0));
  assert.equal(doc.reportId, "executive_dashboard");
  assert.equal(doc.meta.title, "Executive Dashboard");
  const grid = doc.sections[0];
  assert.equal(grid.kind, "kpi_grid");
  if (grid.kind !== "kpi_grid") return;
  assert.equal(grid.items.length, 12);
});

test("a figure that failed exports as Data Unavailable, never zero, and a refused one as No access", () => {
  const doc = executiveDocument(data({ borrowers: { state: "denied" }, products: LOADING }), PERIOD);
  const grid = doc.sections[0];
  if (grid.kind !== "kpi_grid") throw new Error("expected the KPI grid first");
  const byLabel = Object.fromEntries(grid.items.map((i) => [i.label, i.value]));
  assert.equal(byLabel["Total Portfolio"], DATA_UNAVAILABLE);
  assert.equal(byLabel["Active Members"], "No access");
  assert.ok(!Object.values(byLabel).includes("₱0"));
});

test("an outstanding balance carries its as-of-today scope into the export", () => {
  const doc = executiveDocument(
    data({ balance: { state: "ready", data: { outstanding_principal: "1500000" } } }),
    PERIOD,
  );
  const grid = doc.sections[0];
  if (grid.kind !== "kpi_grid") throw new Error("expected the KPI grid first");
  const principal = grid.items.find((i) => i.label === "Total Portfolio");
  assert.equal(principal?.hint?.startsWith("As of today"), true);
});

test("the export's tables carry the screen's columns and dates in words", () => {
  const doc = executiveDocument(
    data({
      aging: { state: "ready", data: { buckets: { "1_30": { amount: "50", count: 2 } } } },
      performance: { state: "ready", data: { by_branch: [{ branch_id: 1, branch_name: "Main", active_borrowers: 7 }] } },
    }),
    PERIOD,
  );
  const tables = doc.sections.filter((s) => s.kind === "table");
  const aging = tables.find((t) => t.title?.startsWith("Past Due Aging"));
  assert.equal(aging?.title, "Past Due Aging (as of Nov 17, 2026)");
  assert.deepEqual(aging?.columns.map((c) => c.header), ["Days past due", "Loans", "Amount"]);
  const branches = tables.find((t) => t.title === "Branch Performance");
  assert.deepEqual(branches?.columns.map((c) => c.header), [
    "Branch",
    "Members",
    "Outstanding",
    "Released",
    "Collected",
    "Collection rate",
    "PAR 30",
  ]);
  assert.equal(branches?.rows[0].members, "7");
  const products = tables.find((t) => t.title?.startsWith("Portfolio by Product"));
  assert.deepEqual(products?.columns.map((c) => c.header), ["Product", "Loans", "Outstanding", "Share of released", "PAR 30"]);
});
