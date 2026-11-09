import { test } from "node:test";
import assert from "node:assert/strict";
import { scorecardBody, scorecardDraftFrom } from "./scorecard-form";
import type { ScorecardConfig } from "@/types/credit-scoring";

const config: ScorecardConfig = {
  version: "1.0",
  validated: false,
  categories: [
    { key: "payment_history", label: "Payment history", weight_percent: "35.00", description: "" },
    { key: "capacity", label: "Capacity", weight_percent: 25, description: "" },
    { key: "tenure", label: "Tenure", weight_percent: "40.00", description: "" },
  ],
  factor_rules: [{ id: 1, category_key: "payment_history", label: "On time", points: 10, is_active: true }],
  policy_rules: [{ id: 9, label: "Past due", description: "More than 30 days", is_active: true }],
  risk_bands: [
    { key: "very_low", label: "Very Low Risk", min_score: 90 },
    { key: "low", label: "Low Risk", min_score: 75 },
    { key: "moderate", label: "Moderate Risk", min_score: 60 },
    { key: "elevated", label: "Elevated Risk", min_score: 45 },
    { key: "high", label: "High Risk", min_score: 30 },
    { key: "very_high", label: "Very High Risk", min_score: 0 },
  ],
};

test("the draft starts from the server's weights and band minimums as text", () => {
  const draft = scorecardDraftFrom(config);
  assert.deepEqual(draft.weights, { payment_history: "35.00", capacity: "25", tenure: "40.00" });
  assert.equal(draft.bands.very_low, "90");
  assert.equal(draft.bands.very_high, "0");
});

test("weights go exactly as typed, never rounded, and a 99.99 total still sends", () => {
  const draft = scorecardDraftFrom(config);
  draft.weights.payment_history = "33.33";
  draft.weights.capacity = "26.66";
  const body = scorecardBody(config, draft);
  assert.deepEqual(body.categories, [
    { key: "payment_history", weight_percent: "33.33" },
    { key: "capacity", weight_percent: "26.66" },
    { key: "tenure", weight_percent: "40.00" },
  ]);
});

test("band minimums go as whole numbers; anything else goes as typed for the server to refuse", () => {
  const draft = scorecardDraftFrom(config);
  draft.bands.low = "70";
  draft.bands.high = "30.5";
  const body = scorecardBody(config, draft);
  assert.deepEqual(body.risk_bands.map((b) => [b.key, b.min_score]), [
    ["very_low", 90],
    ["low", 70],
    ["moderate", 60],
    ["elevated", 45],
    ["high", "30.5"],
    ["very_high", 0],
  ]);
});

test("factor and policy rules go back unchanged", () => {
  const body = scorecardBody(config, scorecardDraftFrom(config));
  assert.deepEqual(body.factor_rules, config.factor_rules);
  assert.deepEqual(body.policy_rules, config.policy_rules);
});
