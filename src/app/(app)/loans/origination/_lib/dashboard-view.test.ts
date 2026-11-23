import { test } from "node:test";
import assert from "node:assert/strict";
import { KPI_TILES, kpiText, previousText } from "./dashboard-view";

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
