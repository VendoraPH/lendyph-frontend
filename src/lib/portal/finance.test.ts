import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gcashAmountProblem,
  isPayable,
  paidPercent,
  periodProblem,
  presetRange,
  statementFilename,
  toAmount,
} from "./finance";

test("toAmount reads decimal strings and absent values", () => {
  assert.equal(toAmount("1250.50"), 1250.5);
  assert.equal(toAmount(null), 0);
  assert.equal(toAmount("abc"), 0);
});

test("paidPercent floors and clamps", () => {
  assert.equal(paidPercent("999.99", "1000"), 99);
  assert.equal(paidPercent(1200, 1000), 100);
  assert.equal(paidPercent(100, 0), 0);
});

test("isPayable", () => {
  assert.equal(isPayable("past_due"), true);
  assert.equal(isPayable("paid"), false);
  assert.equal(isPayable("pending"), false);
});

test("gcashAmountProblem", () => {
  assert.equal(gcashAmountProblem(500, "1000.00"), null);
  assert.equal(gcashAmountProblem(1000, "1000.00"), null);
  assert.match(gcashAmountProblem(0, 1000)!, /Enter/);
  assert.match(gcashAmountProblem(1000.01, "1000.00")!, /more than/);
  assert.match(gcashAmountProblem(10.555, 1000)!, /two decimal/);
  assert.match(gcashAmountProblem(50, 1000, 100)!, /smallest/);
});

test("presetRange uses local calendar dates", () => {
  const today = new Date(2026, 2, 15); // 15 Mar 2026
  assert.deepEqual(presetRange("this_month", today), { from: "2026-03-01", to: "2026-03-15" });
  assert.deepEqual(presetRange("last_month", today), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(presetRange("last_3_months", today), { from: "2026-01-01", to: "2026-03-15" });
  assert.deepEqual(presetRange("this_year", today), { from: "2026-01-01", to: "2026-03-15" });
  assert.deepEqual(presetRange("last_month", new Date(2026, 0, 10)), { from: "2025-12-01", to: "2025-12-31" });
});

test("periodProblem", () => {
  assert.equal(periodProblem("2026-01-01", "2026-01-31", "2026-02-01"), null);
  assert.match(periodProblem("", "2026-01-31", "2026-02-01")!, /both/);
  assert.match(periodProblem("2026-02-01", "2026-01-31", "2026-02-01")!, /after/);
  assert.match(periodProblem("2026-01-01", "2026-03-01", "2026-02-01")!, /future/);
  assert.equal(periodProblem("2025-01-01", "2025-12-31", "2026-02-01"), null);
  assert.match(periodProblem("2025-01-01", "2026-01-01", "2026-02-01")!, /one year/);
});

test("statementFilename", () => {
  assert.equal(
    statementFilename("share_capital", "2026-01-01", "2026-01-31"),
    "statement-share-capital-2026-01-01-to-2026-01-31.pdf",
  );
  assert.equal(statementFilename("loan", "a", "b", "LN 0012/x"), "statement-loan-LN-0012-x-a-to-b.pdf");
});
