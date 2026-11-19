import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AccountingDashboard } from "@/types/accounting";
import { LOADING, SOURCE_PERMISSIONS, cashBalance, sourcePermitted, type ExecutiveData } from "./executive-data";
import {
  agingPoints,
  collectionTrend,
  hasActivity,
  incomeExpenseSeries,
  monthLabel,
  officerRows,
  pipelineStages,
} from "./executive-sections";
import { attentionItems, attentionStatus } from "./attention";

const ready = <T,>(data: T) => ({ state: "ready" as const, data });

function data(overrides: Partial<ExecutiveData> = {}): ExecutiveData {
  return {
    balance: LOADING,
    aging: LOADING,
    cashFlow: LOADING,
    efficiency: LOADING,
    products: LOADING,
    performance: LOADING,
    provisioning: LOADING,
    shareCapital: LOADING,
    income: LOADING,
    borrowers: LOADING,
    disbursements: LOADING,
    accounting: LOADING,
    loanStats: LOADING,
    pastDue: LOADING,
    ...overrides,
  };
}

test("a chart with nothing but zeros or gaps draws the empty state, not an axis", () => {
  const acc = {
    months: [
      { month: "2026-10", income: 0, expenses: 0, net_income: 0, cash: 0 },
      { month: "2026-11", income: 0, expenses: 0, net_income: 0, cash: 0 },
    ],
  } as unknown as AccountingDashboard;
  assert.equal(hasActivity(incomeExpenseSeries(acc), ["income", "expenses", "net"]), false);
  assert.equal(hasActivity([], ["income"]), false);
  assert.equal(hasActivity([{ due: 0, collected: 12.5 }], ["due", "collected"]), true);
});

test("officers read everything owed, not the deprecated alias", () => {
  const rows = officerRows({
    by_officer: [
      { officer_id: 1, officer_name: "Ana", total_outstanding: "500", outstanding: "1" },
      { officer_id: 2, officer_name: "Ben", total_outstanding: "900", outstanding: "2" },
    ],
  });
  assert.deepEqual(rows.map((r) => [r.name, r.outstanding]), [
    ["Ben", 900],
    ["Ana", 500],
  ]);
});

test("cash is the server's money-account balance at the as-of date, never a browser sum of kinds", () => {
  const acc = {
    cash_on_hand: 100,
    cash_in_bank: 200,
    e_wallets: 300,
    months: [
      { month: "2026-10", income: 0, expenses: 0, net_income: 0, cash: 50_000 },
      { month: "2026-11", income: 0, expenses: 0, net_income: 0, cash: 123_456 },
    ],
  } as unknown as AccountingDashboard;
  assert.equal(cashBalance(acc), 1234.56);
  assert.equal(cashBalance({ ...acc, months: [] }), null);
  assert.equal(cashBalance(null), null);
});

test("each source is read only with every permission its figures need", () => {
  assert.deepEqual(SOURCE_PERMISSIONS.balance, ["reports:view"]);
  assert.deepEqual(SOURCE_PERMISSIONS.pastDue, ["reports:view"]);
  assert.deepEqual(SOURCE_PERMISSIONS.accounting, ["accounting:view"]);
  assert.deepEqual(SOURCE_PERMISSIONS.loanStats, ["loans:view"]);
  // The Dashboard's own Share Capital card needs share_capital:view; this one does too.
  assert.deepEqual(SOURCE_PERMISSIONS.shareCapital, ["reports:view", "share_capital:view"]);
});

test("the Share Capital report is never requested without share_capital:view (Phase 6 decision 10)", () => {
  // The report answers 403 without it, so the hook skips the call and the figure reads "No access".
  const reportsOnly = new Set(["reports:view"]);
  assert.equal(sourcePermitted("shareCapital", reportsOnly), false);
  assert.equal(sourcePermitted("balance", reportsOnly), true);
  assert.equal(sourcePermitted("shareCapital", new Set(["reports:view", "share_capital:view"])), true);
  const hook = readFileSync(join(import.meta.dirname, "..", "_hooks", "use-executive-dashboard.ts"), "utf8");
  assert.match(hook, /if \(!load \|\| !sourcePermitted\(name, allowed\)\) continue;/);
});

test("aging is empty without a report, so the chart never draws invented zeros", () => {
  assert.deepEqual(agingPoints(null), []);
  const points = agingPoints({ buckets: { "1_30": { amount: "50", count: 2 } } });
  assert.deepEqual(points[0], { bucket: "1–30 days", amount: 50, count: 2 });
  assert.equal(points.length, 4);
});

test("trend, pipeline and month labels", () => {
  assert.deepEqual(collectionTrend({ by_period: [{ period: "2026-10", total_due: "100", total_collected: "90", collection_rate: 90 }] }), [
    { period: "2026-10", due: 100, collected: 90, rate: 90 },
  ]);
  assert.deepEqual(pipelineStages(null), []);
  assert.equal(pipelineStages({ for_review: 3 }).find((s) => s.status === "for_review")?.count, 3);
  assert.equal(pipelineStages({ for_review: 3 }).find((s) => s.status === "for_review")?.label, "For Approval");
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

test("attention: past due is the grace-rule total, and a missing figure reads a dash, never ₱0.00", () => {
  const items = attentionItems(
    data({
      balance: ready({ par_ratio: "6", overdue: { total: "999" } }),
      pastDue: ready({ past_due_amount: "1500.00" }),
      efficiency: ready({ collection_rate: 85, total_due: 1000 }),
    }),
  );
  const par = items.find((i) => i.id === "par")?.detail ?? "";
  assert.match(par, /— of principal/);
  assert.doesNotMatch(par, /₱0\.00/);
  const collection = items.find((i) => i.id === "collection")?.detail ?? "";
  assert.match(collection, /^— of the amount due/);

  const quiet = attentionItems(data({ balance: ready({ par_ratio: "1", overdue: { total: "999" } }), pastDue: ready({ past_due_amount: "1500.00" }) }));
  assert.equal(quiet.find((i) => i.id === "past-due")?.detail.startsWith("₱1,500.00"), true);
});

test("attention: the over-90 count is of loans, as the aging report counts them", () => {
  const items = attentionItems(data({ aging: ready({ buckets: { over_90: { amount: "800", count: 3 } } }) }));
  assert.equal(items.find((i) => i.id === "over-90")?.detail, "₱800.00 across 3 loans.");
});

test("attention reads Not available when its data failed, never Nothing needs attention", () => {
  const failed = Object.fromEntries(Object.keys(data()).map((k) => [k, { state: "error" }])) as unknown as ExecutiveData;
  assert.equal(attentionStatus(failed), "failed");
  assert.equal(attentionStatus(data()), "loading");
  const fine = Object.fromEntries(Object.keys(data()).map((k) => [k, ready({})])) as unknown as ExecutiveData;
  assert.equal(attentionStatus(fine), "ready");
  // A source the user may not read is not a failure.
  assert.equal(attentionStatus({ ...fine, accounting: { state: "denied" } }), "ready");
  assert.equal(attentionStatus({ ...fine, pastDue: { state: "error" } }), "failed");
});

test("balances are asked for as of today: never a past as_of_date (No backfill)", () => {
  const hook = readFileSync(join(import.meta.dirname, "..", "_hooks", "use-executive-dashboard.ts"), "utf8");
  assert.doesNotMatch(hook, /as_of_date/);
});
