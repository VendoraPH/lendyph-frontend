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
  factor_rules: [
    {
      id: 1,
      category_key: "payment_history",
      label: "On time",
      points: 10,
      is_active: true,
      rule: "at_least",
      bands: [
        { threshold: 95, points: 10 },
        { threshold: 1.5, points: 6 },
      ],
      otherwise: 0,
      unit: "%",
    },
    {
      id: 4,
      category_key: "payment_history",
      label: "Defaults",
      points: 5,
      is_active: false,
      rule: "at_most",
      bands: [{ threshold: 0, points: 5 }],
      otherwise: 1,
      default_points: 0,
      unit: "restructured loans",
    },
  ],
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

test("policy rules go back unchanged, and unchanged factors go back with their own ranges", () => {
  const body = scorecardBody(config, scorecardDraftFrom(config));
  assert.deepEqual(body.policy_rules, config.policy_rules);
  assert.deepEqual(body.factor_rules, [
    {
      id: 1,
      category_key: "payment_history",
      label: "On time",
      points: 10,
      is_active: true,
      rule: "at_least",
      bands: [
        { threshold: "95", points: 10 },
        { threshold: "1.5", points: 6 },
      ],
      otherwise: 0,
    },
    {
      id: 4,
      category_key: "payment_history",
      label: "Defaults",
      points: 5,
      is_active: false,
      rule: "at_most",
      bands: [{ threshold: "0", points: 5 }],
      otherwise: 1,
      default_points: 0,
    },
  ]);
});

test("edited ranges go as typed: thresholds as text, whole-number points as numbers, the rest for the server to refuse", () => {
  const draft = scorecardDraftFrom(config);
  draft.factors[1] = {
    bands: [
      { threshold: " 97.50 ", points: "10" },
      { threshold: "90", points: "7.5" },
      { threshold: "80", points: "" },
    ],
    otherwise: "2",
  };
  draft.factors[4] = { ...draft.factors[4], default_points: "x" };
  const [onTime, defaults] = scorecardBody(config, draft).factor_rules;
  assert.deepEqual(onTime.bands, [
    { threshold: "97.50", points: 10 },
    { threshold: "90", points: "7.5" },
    { threshold: "80", points: "" },
  ]);
  assert.equal(onTime.otherwise, 2);
  assert.equal("default_points" in onTime, false);
  assert.equal(defaults.default_points, "x");
});

test("a factor's fixed fields go back as the server sent them, and its unit is never sent", () => {
  const draft = scorecardDraftFrom(config);
  const [onTime, defaults] = scorecardBody(config, draft).factor_rules;
  for (const [sent, own] of [
    [onTime, config.factor_rules[0]],
    [defaults, config.factor_rules[1]],
  ] as const) {
    assert.equal(sent.id, own.id);
    assert.equal(sent.category_key, own.category_key);
    assert.equal(sent.label, own.label);
    assert.equal(sent.points, own.points);
    assert.equal(sent.is_active, own.is_active);
    assert.equal(sent.rule, own.rule);
    assert.equal("unit" in sent, false);
  }
});
