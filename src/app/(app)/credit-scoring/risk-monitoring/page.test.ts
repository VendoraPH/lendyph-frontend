/** Risk monitoring, read from source: a null count reads a dash. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/credit-scoring/risk-monitoring/page.tsx"), "utf8");

test("the new hard flags count reads a dash when the server sends null", () => {
  assert.match(page, /value=\{countOrDash\(data\.summary\.new_hard_flags_30d\)\}/);
  assert.doesNotMatch(page, /String\(data\.summary\./);
});

test("an affected member's past due reads a dash when null", () => {
  assert.match(page, /<TableCell>\{yesNoOrDash\(row\.past_due\)\}<\/TableCell>/);
  assert.doesNotMatch(page, /\? "Yes" : "No"/);
});

test("Past Due Members and High Risk Exposure read a dash, with the reason, when the server withholds them", () => {
  assert.match(
    page,
    /label="Past Due Members"\s+value=\{countOrDash\(data\.summary\.past_due_borrowers\)\}\s+hiddenReason=\{loanFigureReason\(data\.summary\.past_due_borrowers\)\}/,
  );
  assert.match(
    page,
    /label="High Risk Exposure"\s+value=\{pesosOrDash\(data\.summary\.high_risk_exposure\)\}\s+hiddenReason=\{loanFigureReason\(data\.summary\.high_risk_exposure\)\}/,
  );
});
