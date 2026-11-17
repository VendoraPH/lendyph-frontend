import { test } from "node:test";
import assert from "node:assert/strict";
import { LOADING, type ExecutiveData } from "./executive-data";
import { executiveDocument } from "./executive-export";
import { DATA_UNAVAILABLE } from "./metrics";

const KEYS: (keyof ExecutiveData)[] = [
  "balance", "aging", "cashFlow", "prevCashFlow", "efficiency", "prevEfficiency", "products", "performance",
  "provisioning", "shareCapital", "income", "borrowers", "disbursements", "prevDisbursements", "accounting", "loanStats",
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
  assert.equal(byLabel["Outstanding Portfolio"], DATA_UNAVAILABLE);
  assert.equal(byLabel["Active Borrowers"], "No access");
  assert.ok(!Object.values(byLabel).includes("₱0"));
});

test("an outstanding balance carries its as-of-today scope into the export", () => {
  const doc = executiveDocument(
    data({ balance: { state: "ready", data: { outstanding: { principal: "1500000" } } } }),
    PERIOD,
  );
  const grid = doc.sections[0];
  if (grid.kind !== "kpi_grid") throw new Error("expected the KPI grid first");
  const principal = grid.items.find((i) => i.label === "Outstanding Portfolio");
  assert.equal(principal?.hint?.startsWith("As of today"), true);
});
