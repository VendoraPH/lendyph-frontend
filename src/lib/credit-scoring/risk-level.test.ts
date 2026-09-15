import { test } from "node:test";
import assert from "node:assert/strict";
import { riskLevelColor, riskLevelFromScore, riskLevelLabel } from "./risk-level";
import type { RiskLevel } from "@/types/credit-scoring";

const ALL_LEVELS: RiskLevel[] = ["very_low", "low", "moderate", "elevated", "high", "very_high"];

test("every risk level has a non-empty label", () => {
  for (const level of ALL_LEVELS) assert.ok(riskLevelLabel(level).length > 0);
});

test("every risk level has a non-empty color class", () => {
  for (const level of ALL_LEVELS) assert.ok(riskLevelColor(level).length > 0);
});

const THRESHOLDS = [
  { level: "very_low" as RiskLevel, min: 90 },
  { level: "low" as RiskLevel, min: 75 },
  { level: "moderate" as RiskLevel, min: 60 },
  { level: "elevated" as RiskLevel, min: 45 },
  { level: "high" as RiskLevel, min: 30 },
  { level: "very_high" as RiskLevel, min: 0 },
];

test("a score maps to the band whose minimum it clears", () => {
  assert.equal(riskLevelFromScore(95, THRESHOLDS), "very_low");
  assert.equal(riskLevelFromScore(80, THRESHOLDS), "low");
  assert.equal(riskLevelFromScore(60, THRESHOLDS), "moderate");
  assert.equal(riskLevelFromScore(45, THRESHOLDS), "elevated");
  assert.equal(riskLevelFromScore(30, THRESHOLDS), "high");
  assert.equal(riskLevelFromScore(5, THRESHOLDS), "very_high");
});

test("a score below every threshold falls to the lowest remaining band", () => {
  const withoutFloor = THRESHOLDS.filter((t) => t.level !== "very_high");
  // Lowest remaining band is "high" (min: 30) once "very_high" (min: 0) is removed.
  assert.equal(riskLevelFromScore(5, withoutFloor), "high");
});
