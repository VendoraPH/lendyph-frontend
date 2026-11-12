import { test } from "node:test";
import assert from "node:assert/strict";
import { branchRiskCells, branchRiskName, riskLegend, riskLevelColor, riskLevelLabel } from "./risk-level";
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

test("a branch row lists all six levels in order, in words, with the server's counts", () => {
  const cells = branchRiskCells({
    branch_id: 2,
    branch_name: "North",
    members_scored: 3,
    average_score: 71.5,
    risk_distribution: [
      { risk_level: "very_low", count: 1 },
      { risk_level: "high", count: 2 },
    ],
  });
  assert.deepEqual(
    cells.map((c) => [c.level, c.label, c.count]),
    [
      ["very_low", "Very Low Risk", "1"],
      ["low", "Low Risk", "—"],
      ["moderate", "Moderate Risk", "—"],
      ["elevated", "Elevated Risk", "—"],
      ["high", "High Risk", "2"],
      ["very_high", "Very High Risk", "—"],
    ],
  );
});

test("members with no branch form a row named in words", () => {
  assert.equal(branchRiskName({ branch_name: null }), "No branch");
  assert.equal(branchRiskName({ branch_name: "Main Office" }), "Main Office");
});
