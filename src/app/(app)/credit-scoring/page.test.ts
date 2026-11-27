/** The credit scoring dashboard, read from source: the donut has a legend. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/credit-scoring/page.tsx"), "utf8");

test("the risk distribution donut has a legend with each band's name and count", () => {
  assert.match(page, /<ul aria-label="Risk distribution legend"/);
  assert.match(page, /\{riskLegend\(data\.risk_distribution\)\.map\(\(item\) => \(/);
  assert.match(page, /\{item\.label\}/);
  assert.match(page, /\{item\.count\}/);
});

test("High Risk Outstanding reads the server's ₱ figure, or a dash with the reason when it's withheld", () => {
  assert.match(
    page,
    /label="High Risk Outstanding"\s+value=\{pesosOrDash\(data\.high_risk_outstanding\)\}\s+hiddenReason=\{loanFigureReason\(data\.high_risk_outstanding\)\}/,
  );
  assert.match(page, /label="Scores Due for Review" value=\{countOrDash\(data\.scores_due_for_review\)\}/);
  assert.doesNotMatch(page, /formatCurrency\(|toFixed\(/);
});

test("the dashboard shows the server's portfolio risk by branch", () => {
  assert.match(page, /<BranchRiskTable rows=\{data\.branch_risk\} \/>/);
});
