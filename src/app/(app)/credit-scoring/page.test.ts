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
