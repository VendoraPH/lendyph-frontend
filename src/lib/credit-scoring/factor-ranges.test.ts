import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FACTOR_BANDS,
  factorDraftFrom,
  factorRangeErrors,
  ruleOrderNote,
  withBandAdded,
  withBandChanged,
  withBandRemoved,
} from "./factor-ranges";
import type { ScorecardFactorRule } from "@/types/credit-scoring";

const onTime: ScorecardFactorRule = {
  id: 1,
  category_key: "repayment",
  label: "On-time payment rate",
  points: 15,
  is_active: true,
  rule: "at_least",
  bands: [
    { threshold: 95, points: 15 },
    { threshold: 90, points: 12 },
  ],
  otherwise: 0,
  unit: "%",
};

const defaults: ScorecardFactorRule = {
  id: 4,
  category_key: "repayment",
  label: "Defaults and restructures",
  points: 5,
  is_active: true,
  rule: "at_most",
  bands: [{ threshold: 0, points: 5 }],
  otherwise: 0,
  default_points: 0,
  unit: "restructured loans",
};

const rules = [onTime, defaults];

function unprocessable(errors: Record<string, string[]>) {
  return { response: { status: 422, data: { message: "Invalid", errors } } };
}

test("a factor's draft holds its ranges as text, with default points only where the factor has them", () => {
  assert.deepEqual(factorDraftFrom(onTime), {
    bands: [
      { threshold: "95", points: "15" },
      { threshold: "90", points: "12" },
    ],
    otherwise: "0",
  });
  assert.equal(factorDraftFrom(defaults).default_points, "0");
  assert.equal(factorDraftFrom({ ...onTime, bands: [{ threshold: 1.5, points: 5 }] }).bands[0].threshold, "1.5");
});

test("ranges are added up to the limit and removed down to one, never changing the others", () => {
  const draft = factorDraftFrom(onTime);
  const added = withBandAdded(draft);
  assert.deepEqual(added.bands[2], { threshold: "", points: "" });
  assert.deepEqual(added.bands.slice(0, 2), draft.bands);
  assert.deepEqual(withBandRemoved(added, 0).bands, [draft.bands[1], { threshold: "", points: "" }]);

  let full = draft;
  while (full.bands.length < MAX_FACTOR_BANDS) full = withBandAdded(full);
  assert.equal(withBandAdded(full).bands.length, MAX_FACTOR_BANDS);

  const single = withBandRemoved(draft, 1);
  assert.equal(single.bands.length, 1);
  assert.equal(withBandRemoved(single, 0).bands.length, 1);

  const changed = withBandChanged(draft, 1, "threshold", "88.5");
  assert.equal(changed.bands[1].threshold, "88.5");
  assert.equal(draft.bands[1].threshold, "90");
});

test("the rule's order reads in words for each direction", () => {
  assert.match(ruleOrderNote("at_least"), /highest .* first/i);
  assert.match(ruleOrderNote("at_least"), /reaches/);
  assert.match(ruleOrderNote("at_most"), /lowest .* first/i);
  assert.doesNotMatch(ruleOrderNote("at_most"), /at_most/);
});

test("the server's own worded messages are kept, under the factor they name", () => {
  const out = factorRangeErrors(
    unprocessable({
      "factor_rules.0.bands": [
        "On-time payment rate: each threshold must be below the one before it, highest first; the first range the value reaches is used.",
      ],
      "factor_rules.1.default_points": ["Defaults and restructures: the points for a defaulted or written-off loan must be from 0 to 5."],
      factor_rules: ["The factors must be exactly the current scorecard's, once each."],
      categories: ["The weights must total exactly 100.00."],
    }),
    rules,
  );
  assert.deepEqual(out.general, ["The factors must be exactly the current scorecard's, once each."]);
  assert.deepEqual(out.byFactor[1], [
    "On-time payment rate: each threshold must be below the one before it, highest first; the first range the value reaches is used.",
  ]);
  assert.deepEqual(out.byFactor[4], [
    "Defaults and restructures: the points for a defaulted or written-off loan must be from 0 to 5.",
  ]);
});

test("Laravel's default messages, which name raw fields, are put in words", () => {
  const out = factorRangeErrors(
    unprocessable({
      "factor_rules.0.bands.1.threshold": ["The factor rules.0.bands.1.threshold field must have 0-2 decimal places."],
      "factor_rules.0.bands.0.points": ["The factor_rules.0.bands.0.points field must be an integer."],
      "factor_rules.1.otherwise": ["The factor rules.1.otherwise field must be at least 0."],
      "factor_rules.1.bands": ["The factor rules.1.bands field must have at least 1 items."],
    }),
    rules,
  );
  assert.deepEqual(out.byFactor[1], [
    "On-time payment rate, range 2: the threshold must be a number from 0 to 1,000,000, with at most two decimals.",
    "On-time payment rate, range 1: the points must be a whole number from 0 to 15.",
  ]);
  assert.deepEqual(out.byFactor[4], [
    "Defaults and restructures: the points for any other value must be a whole number from 0 to 5.",
    "Defaults and restructures: a factor needs 1 to 10 ranges.",
  ]);
  for (const messages of Object.values(out.byFactor)) {
    for (const m of messages) assert.doesNotMatch(m, /factor[ _]rules|bands\.|_/);
  }
});

test("anything but a 422 gives no field messages", () => {
  assert.deepEqual(factorRangeErrors(new Error("Network"), rules), { general: [], byFactor: {} });
  assert.deepEqual(factorRangeErrors({ response: { status: 500 } }, rules), { general: [], byFactor: {} });
});
