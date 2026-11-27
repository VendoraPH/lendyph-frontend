import { test } from "node:test";
import assert from "node:assert/strict";
import { FACTOR_RULE_LABELS, MEMBER_TYPE_LABELS, SCORE_TREND_LABELS } from "./labels";

test("trends, member types and factor rules read in words, never as their keys", () => {
  assert.deepEqual(SCORE_TREND_LABELS, { up: "Score went up", down: "Score went down", flat: "No change" });
  assert.deepEqual(MEMBER_TYPE_LABELS, { regular: "Regular", associate: "Associate" });
  assert.deepEqual(FACTOR_RULE_LABELS, { at_least: "at least", at_most: "at most" });
  for (const labels of [SCORE_TREND_LABELS, MEMBER_TYPE_LABELS, FACTOR_RULE_LABELS]) {
    for (const [key, label] of Object.entries(labels)) {
      assert.doesNotMatch(label, /_/, key);
    }
  }
});
