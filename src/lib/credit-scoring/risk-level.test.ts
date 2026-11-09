import { test } from "node:test";
import assert from "node:assert/strict";
import { riskLevelColor, riskLevelLabel } from "./risk-level";
import type { RiskLevel } from "@/types/credit-scoring";

const ALL_LEVELS: RiskLevel[] = ["very_low", "low", "moderate", "elevated", "high", "very_high"];

test("every risk level has a non-empty label", () => {
  for (const level of ALL_LEVELS) assert.ok(riskLevelLabel(level).length > 0);
});

test("every risk level has a non-empty color class", () => {
  for (const level of ALL_LEVELS) assert.ok(riskLevelColor(level).length > 0);
});
