import { test } from "node:test";
import assert from "node:assert/strict";
import { confidenceColor, confidenceLabel } from "./confidence";
import type { ScoreConfidence } from "@/types/credit-scoring";

const ALL_LEVELS: ScoreConfidence[] = ["high", "medium", "low"];

test("every confidence level has a non-empty label", () => {
  for (const level of ALL_LEVELS) assert.ok(confidenceLabel(level).length > 0);
});

test("every confidence level has a non-empty color class", () => {
  for (const level of ALL_LEVELS) assert.ok(confidenceColor(level).length > 0);
});

test("labels are distinct across levels", () => {
  const labels = ALL_LEVELS.map(confidenceLabel);
  assert.equal(new Set(labels).size, labels.length);
});
