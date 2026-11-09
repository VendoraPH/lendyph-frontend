import { test } from "node:test";
import assert from "node:assert/strict";
import type { DashboardMonth } from "@/types";
import { compactPesoTick, dashboardChartRows, monthLabel, monthTick } from "./dashboard-chart";

const MONTHS: DashboardMonth[] = [
  { month: "2025-12", income: 1_250_000, expenses: 400_050, net_income: 849_950, cash: 9_000_000 },
  { month: "2026-11", income: 0, expenses: 75_000, net_income: -75_000, cash: 8_925_000 },
];

test("chart rows carry the server's figures unchanged, oldest first", () => {
  assert.deepEqual(dashboardChartRows(MONTHS), [
    {
      month: "2025-12",
      tick: "Dec",
      label: "December 2025",
      income: 1_250_000,
      expenses: 400_050,
      net_income: 849_950,
      cash: 9_000_000,
    },
    {
      month: "2026-11",
      tick: "Nov",
      label: "November 2026",
      income: 0,
      expenses: 75_000,
      net_income: -75_000,
      cash: 8_925_000,
    },
  ]);
});

test("a missing month figure stays missing, never zero", () => {
  const partial = [{ month: "2026-10", income: 5_000 } as unknown as DashboardMonth];
  const [row] = dashboardChartRows(partial);
  assert.equal(row.income, 5_000);
  assert.equal(row.expenses, null);
  assert.equal(row.net_income, null);
  assert.equal(row.cash, null);
});

test("no months, or none sent, gives no rows", () => {
  assert.deepEqual(dashboardChartRows([]), []);
  assert.deepEqual(dashboardChartRows(undefined), []);
});

test("month labels read in words, and a bad month reads as sent", () => {
  assert.equal(monthLabel("2026-01"), "January 2026");
  assert.equal(monthTick("2026-01"), "Jan");
  assert.equal(monthLabel("2026-13"), "2026-13");
  assert.equal(monthTick("soon"), "soon");
});

test("axis ticks abbreviate whole pesos, with the ₱ sign", () => {
  assert.equal(compactPesoTick(0), "₱0");
  assert.equal(compactPesoTick(50_000), "₱500");
  assert.equal(compactPesoTick(13_000_000), "₱130K");
  assert.equal(compactPesoTick(250_000_000), "₱2.5M");
  assert.equal(compactPesoTick(-7_500_000), "-₱75K");
});
