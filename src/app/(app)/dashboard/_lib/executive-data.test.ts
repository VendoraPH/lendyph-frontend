import { test } from "node:test";
import assert from "node:assert/strict";
import type { AccountingDashboard } from "@/types/accounting";
import { LOADING, overviewKpis, type ExecutiveData, type KpiView } from "./executive-data";
import { agingPoints, branchRows, collectionTrend, monthLabel, pipelineStages, productRows } from "./executive-sections";
import { attentionItems } from "./attention";

const ready = <T,>(data: T) => ({ state: "ready" as const, data });

function data(overrides: Partial<ExecutiveData> = {}): ExecutiveData {
  return {
    balance: LOADING,
    aging: LOADING,
    cashFlow: LOADING,
    prevCashFlow: LOADING,
    efficiency: LOADING,
    prevEfficiency: LOADING,
    products: LOADING,
    performance: LOADING,
    provisioning: LOADING,
    shareCapital: LOADING,
    income: LOADING,
    borrowers: LOADING,
    disbursements: LOADING,
    prevDisbursements: LOADING,
    accounting: LOADING,
    loanStats: LOADING,
    ...overrides,
  };
}

const kpi = (views: KpiView[], id: KpiView["id"]) => views.find((v) => v.id === id)!;

test("cards wait while loading, and say so when a figure is missing or not allowed", () => {
  const views = overviewKpis(
    data({
      balance: ready({ outstanding: { principal: "1000.00" } }),
      borrowers: { state: "denied" },
      cashFlow: { state: "error" },
    }),
  );
  assert.deepEqual(kpi(views, "outstanding_principal"), {
    id: "outstanding_principal",
    value: 1000,
    change: null,
    changeBasis: null,
    state: "ready",
  });
  assert.equal(kpi(views, "outstanding_balance").state, "unavailable");
  assert.equal(kpi(views, "active_borrowers").state, "denied");
  assert.equal(kpi(views, "collections").state, "unavailable");
  assert.equal(kpi(views, "net_income").state, "loading");
});

test("period figures compare with the previous period; a zero base has no change", () => {
  const views = overviewKpis(
    data({
      cashFlow: ready({ inflows: { repayments: { total: "1500" } } }),
      prevCashFlow: ready({ inflows: { repayments: { total: "1000" } } }),
      efficiency: ready({ collection_rate: 92 }),
      prevEfficiency: ready({ collection_rate: 95 }),
      disbursements: ready({ total_disbursed: 500 }),
      prevDisbursements: ready({ total_disbursed: 0 }),
    }),
  );
  assert.equal(kpi(views, "collections").change, 50);
  assert.equal(kpi(views, "collection_rate").change, -3);
  assert.equal(kpi(views, "loans_released").change, null);
});

test("share capital compares with its opening balance; net income is read from centavos", () => {
  const views = overviewKpis(
    data({
      shareCapital: ready({ opening_balance: "200000", closing_balance: "210000" }),
      accounting: ready({ period: { from: "", to: "", income: 0, expenses: 0, net_income: 1234567 } } as unknown as AccountingDashboard),
    }),
  );
  assert.equal(kpi(views, "share_capital").change, 5);
  assert.equal(kpi(views, "share_capital").changeBasis, "opening_balance");
  assert.equal(kpi(views, "net_income").value, 12345.67);
});

test("past due adds principal, interest and penalty", () => {
  const views = overviewKpis(data({ balance: ready({ overdue: { principal: "100", interest: "10.5", penalty: null } }) }));
  assert.equal(kpi(views, "past_due_amount").value, 110.5);
});

test("products sort by outstanding and share the outstanding book", () => {
  const rows = productRows({
    products: [
      { product_name: "Salary", outstanding: "250" },
      { product_name: "Business", outstanding: "750", par_ratio: "4.5" },
    ],
  });
  assert.deepEqual(rows.map((r) => [r.name, r.share, r.par]), [
    ["Business", 75, 4.5],
    ["Salary", 25, null],
  ]);
});

test("aging is empty without a report, so the chart never draws invented zeros", () => {
  assert.deepEqual(agingPoints(null), []);
  const points = agingPoints({ buckets: { "1_30": { amount: "50", count: 2 } } });
  assert.deepEqual(points[0], { bucket: "1–30 days", amount: 50, count: 2 });
  assert.equal(points.length, 4);
});

test("branches merge across reports by id", () => {
  const rows = branchRows(
    { by_branch: [{ branch_id: 1, branch_name: "Main", outstanding_balance: "900" }] },
    { by_branch: [{ branch_id: 1, branch_name: "Main", total_collected: "80", collection_rate: "88.5" }] },
    { by_branch: [{ branch_id: 2, branch_name: "North", released_amount: "300", par_ratio: 1 }] },
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { name: rows[0].name, outstanding: rows[0].outstanding, collectionRate: rows[0].collectionRate },
    { name: "Main", outstanding: 900, collectionRate: 88.5 },
  );
  assert.equal(rows[1].released, 300);
});

test("trend, pipeline and month labels", () => {
  assert.deepEqual(collectionTrend({ by_period: [{ period: "2026-10", total_due: "100", total_collected: "90", collection_rate: 90 }] }), [
    { period: "2026-10", due: 100, collected: 90, rate: 90 },
  ]);
  assert.deepEqual(pipelineStages(null), []);
  assert.equal(pipelineStages({ for_review: 3 }).find((s) => s.status === "for_review")?.count, 3);
  assert.equal(monthLabel("2026-11"), "Nov 2026");
  assert.equal(monthLabel("Q4"), "Q4");
});

test("attention: nothing is raised from data that did not arrive", () => {
  assert.deepEqual(attentionItems(data()), []);
});

test("attention: critical items come first", () => {
  const items = attentionItems(
    data({
      balance: ready({ par_ratio: "12.5", at_risk_amount: "5000" }),
      efficiency: ready({ collection_rate: 85, total_due: 1000, uncollected: 150 }),
      loanStats: ready({ for_review: 2, approved: 0 }),
      accounting: ready({ is_balanced: false, unposted_journals: 1, adjustments_clearing_needs_review: false } as AccountingDashboard),
    }),
  );
  assert.deepEqual(
    items.map((i) => [i.id, i.tone]),
    [
      ["books-unbalanced", "critical"],
      ["par", "critical"],
      ["collection", "warning"],
      ["for-review", "warning"],
      ["unposted", "warning"],
    ],
  );
  assert.equal(items.find((i) => i.id === "for-review")?.title, "2 applications waiting for approval");
});
