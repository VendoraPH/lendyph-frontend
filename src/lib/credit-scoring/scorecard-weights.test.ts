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

// Laravel serialises a `decimal:2` column as a JSON string, so the values that
// actually arrive from the API are "25.00", not 25. Every fixture above uses
// numbers, which is precisely why `total + c.weight_percent` concatenating went
// unnoticed: it summed to "0252015151510", isValidWeightTotal() returned false,
// and the Save button on the scorecard form was disabled with nothing shown to
// explain why. Casting here is deliberate — it reproduces the wire shape the
// declared type does not admit.
function stringWeighted(key: string, weight: string): ScorecardCategoryConfig {
  return { key, label: key, weight_percent: weight, description: "" } as unknown as ScorecardCategoryConfig;
}

test("sums decimal-string weights as numbers, not by concatenation", () => {
  const cats = [stringWeighted("payment_history", "30.00"), stringWeighted("income_stability", "20.00")];
  assert.equal(sumWeights(cats), 50);
});

test("the six real categories still total 100 when they arrive as strings", () => {
  const cats = [
    stringWeighted("payment_history", "25.00"),
    stringWeighted("credit_utilization", "20.00"),
    stringWeighted("loan_history_length", "15.00"),
    stringWeighted("income_stability", "15.00"),
    stringWeighted("collateral_coverage", "15.00"),
    stringWeighted("behavioral_signals", "10.00"),
  ];
  assert.equal(isValidWeightTotal(cats), true);
});
