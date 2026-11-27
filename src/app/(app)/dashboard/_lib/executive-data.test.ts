import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AccountingDashboard } from "@/types/accounting";
import { SOURCE_PERMISSIONS, sourcePermitted } from "./executive-data";
import {
  agingPoints,
  collectionTrend,
  hasActivity,
  incomeExpenseSeries,
  monthLabel,
  officerRows,
  pipelineStages,
} from "./executive-sections";

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

test("each source is read only with every permission its figures need", () => {
  assert.deepEqual(SOURCE_PERMISSIONS.balance, ["reports:view"]);
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

test("balances are asked for as of today: never a past as_of_date (No backfill)", () => {
  const hook = readFileSync(join(import.meta.dirname, "..", "_hooks", "use-executive-dashboard.ts"), "utf8");
  assert.doesNotMatch(hook, /as_of_date/);
});
