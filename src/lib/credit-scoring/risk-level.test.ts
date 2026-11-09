import { test } from "node:test";
import assert from "node:assert/strict";
import { riskLegend, riskLevelColor, riskLevelLabel } from "./risk-level";
import type { RiskLevel } from "@/types/credit-scoring";

const ALL_LEVELS: RiskLevel[] = ["very_low", "low", "moderate", "elevated", "high", "very_high"];

test("every risk level has a non-empty label", () => {
  for (const level of ALL_LEVELS) assert.ok(riskLevelLabel(level).length > 0);
});

test("every risk level has a non-empty color class", () => {
  for (const level of ALL_LEVELS) assert.ok(riskLevelColor(level).length > 0);
});

test("the risk distribution legend names each band with the server's count, in the server's order", () => {
  assert.deepEqual(
    riskLegend([
      { risk_level: "high", count: 3 },
      { risk_level: "low", count: 0 },
    ]),
    [
      { level: "high", label: "High Risk", count: "3" },
      { level: "low", label: "Low Risk", count: "0" },
    ],
  );
  assert.deepEqual(riskLegend([]), []);
});
