import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidWeightTotal, sumWeights } from "./scorecard-weights";
import type { ScorecardCategoryConfig } from "@/types/credit-scoring";

function category(over: Partial<ScorecardCategoryConfig> = {}): ScorecardCategoryConfig {
  return {
    key: "payment_history",
    label: "Payment History",
    weight_percent: 0,
    description: "",
    ...over,
  };
}

test("sums weight_percent across categories", () => {
  const cats = [category({ weight_percent: 30 }), category({ weight_percent: 20 })];
  assert.equal(sumWeights(cats), 50);
});

test("exactly 100 across the six real categories is valid", () => {
  const cats = [
    category({ key: "payment_history", weight_percent: 25 }),
    category({ key: "credit_utilization", weight_percent: 20 }),
    category({ key: "loan_history_length", weight_percent: 15 }),
    category({ key: "income_stability", weight_percent: 15 }),
    category({ key: "collateral_coverage", weight_percent: 15 }),
    category({ key: "behavioral_signals", weight_percent: 10 }),
  ];
  assert.equal(isValidWeightTotal(cats), true);
});

test("over 100 is invalid", () => {
  assert.equal(isValidWeightTotal([category({ weight_percent: 60 }), category({ weight_percent: 50 })]), false);
});

test("under 100 is invalid", () => {
  assert.equal(isValidWeightTotal([category({ weight_percent: 60 }), category({ weight_percent: 30 })]), false);
});

test("an empty category list is invalid, not vacuously valid", () => {
  assert.equal(isValidWeightTotal([]), false);
});

test("fractional weights that visually sum to 100 pass despite float drift", () => {
  const cats = [
    category({ weight_percent: 16.67 }),
    category({ weight_percent: 16.67 }),
    category({ weight_percent: 16.67 }),
    category({ weight_percent: 16.67 }),
    category({ weight_percent: 16.66 }),
    category({ weight_percent: 16.66 }),
  ];
  assert.equal(isValidWeightTotal(cats), true);
});
