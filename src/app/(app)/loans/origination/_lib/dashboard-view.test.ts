import { test } from "node:test";
import assert from "node:assert/strict";
import { KPI_TILES, kpiChange, kpiText, previousText, turnaroundRows } from "./dashboard-view";

test("money tiles read the server's two-decimal strings in pesos", () => {
  assert.equal(kpiText("125000.50", "money"), "₱125,000.50");
  assert.equal(kpiText("0.00", "money"), "₱0.00");
  // amount_approved is null without loans:view: a dash, never ₱0.00.
  assert.equal(kpiText(null, "money"), "—");
});

test("rates read as the server rounded them, and counts as whole numbers", () => {
  assert.equal(kpiText(66.7, "percent"), "66.7%");
  assert.equal(kpiText(null, "percent"), "—");
  assert.equal(kpiText(1234, "count"), "1,234");
  assert.equal(kpiText(36, "hours"), "36 hours");
});

test("each tile sets the previous period's figure beside it, as the server sent it", () => {
  assert.equal(previousText(12, "count"), "Previous period: 12");
  assert.equal(previousText("4500.00", "money"), "Previous period: ₱4,500.00");
  assert.equal(previousText(null, "percent"), "Previous period: —");
});

test("the tiles cover the server's figures, For Approval in its words", () => {
  const labels = KPI_TILES.map((t) => t.label);
  assert.ok(labels.includes("For approval"));
  assert.ok(!labels.some((l) => /pending approval/i.test(l)));
  const keys = KPI_TILES.map((t) => t.key);
  for (const key of ["amount_requested", "amount_approved", "withdrawn", "converted"]) assert.ok(keys.includes(key as never), key);
});

const stretch = (average: number | null, median: number | null, loans: number, notMeasured = 0) => ({
  loans,
  average_days: average,
  median_days: median,
  not_measured: notMeasured,
});

test("turnaround reads the server's days as sent, one decimal, labelled in words", () => {
  const rows = turnaroundRows({
    submitted_to_approved: stretch(2, 1.5, 4),
    approved_to_released: stretch(0.4, 0.4, 1, 1),
    submitted_to_released: stretch(null, null, 0, 2),
  });
  assert.deepEqual(
    rows.map((r) => [r.label, r.average, r.median, r.loans]),
    [
      ["Submitted to approved", "2.0 days", "1.5 days", "4 loans"],
      ["Approved to released", "0.4 days", "0.4 days", "1 loan"],
      ["Submitted to released", "—", "—", "No loans"],
    ],
  );
  assert.equal(rows[0].note, null);
  assert.equal(rows[1].note, "1 loan had no start to measure from.");
  assert.equal(rows[2].note, "2 loans had no start to measure from.");
});

test("each tile shows the server's change in the executive dashboard's format, never one worked out here", () => {
  const changes = {
    new: { change: 12.5, change_unit: "percent" as const },
    rejected: { change: -40, change_unit: "percent" as const },
    approval_rate: { change: -3, change_unit: "points" as const },
    completion_rate: { change: 200, change_unit: "points" as const },
    amount_approved: { change: null, change_unit: "percent" as const },
  };
  assert.equal(kpiChange(changes, "new"), "+12.5% vs previous period");
  assert.equal(kpiChange(changes, "rejected"), "−40.0% vs previous period");
  assert.equal(kpiChange(changes, "approval_rate"), "−3.00 pts vs previous period");
  assert.equal(kpiChange(changes, "completion_rate"), "+200.00 pts vs previous period");
  // Null (a figure missing or withheld, or a zero before) shows nothing, as the executive dashboard does.
  assert.equal(kpiChange(changes, "amount_approved"), null);
  // A KPI the server sent no change for, or a server that sends no changes yet.
  assert.equal(kpiChange(changes, "total"), null);
  assert.equal(kpiChange(undefined, "new"), null);
});
