import { test } from "node:test";
import assert from "node:assert/strict";
import { csvFileName } from "./export-file-name";

const RANGE = { from: "2026-11-01", to: "2026-11-10" };

test("a report over a period names its dates", () => {
  assert.equal(csvFileName("savings_transactions", {}, RANGE, "2026-11-10"), "savings_transactions-2026-11-01-2026-11-10.csv");
});

test("an as-of report names its as-of day only", () => {
  assert.equal(csvFileName("savings_balances", { noDateRange: true }, RANGE, "2026-11-10"), "savings_balances-2026-11-10.csv");
  assert.equal(csvFileName("savings_gl_control", { noDateRange: true }, RANGE, "2026-11-09"), "savings_gl_control-2026-11-09.csv");
});
