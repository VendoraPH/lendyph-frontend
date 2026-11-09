/**
 * The Credit Assessment card's wiring, read from source: the gate runs before
 * anything fetches, and the loan page gains exactly one import and one render
 * line. The gate's own rules are tested in
 * src/lib/credit-scoring/assessment-card.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = join(process.cwd(), "src/app/(app)/loans/[id]");
const card = readFileSync(join(here, "_components/credit-assessment-card.tsx"), "utf8");
const page = readFileSync(join(here, "page.tsx"), "utf8");

function body(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nfunction ", start + 1);
  const nextExport = source.indexOf("\nexport function ", start + 1);
  const ends = [next, nextExport].filter((i) => i > 0);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

test("the card checks the flag, the status and both permissions before rendering its body", () => {
  const outer = body(card, "CreditAssessmentCard");
  assert.match(outer, /showsCreditAssessment\(\{\s*flagOn: env\.features\.creditScoring,\s*status,\s*can\s*\}\)/);
  assert.match(outer, /return null;/);
  assert.doesNotMatch(outer, /useApiResource|creditScoringService/);
});

test("only the gated body asks the server", () => {
  const inner = body(card, "CreditAssessmentBody");
  assert.match(inner, /useApiResource/);
  assert.match(inner, /getLoanAssessment\(loanId\)/);
  assert.equal((card.match(/useApiResource[<(]/g) ?? []).length, 1);
});

test("save needs loans:update as well, and a decision carries the loan and the assessment score", () => {
  assert.match(card, /canSave=\{canSaveAssessment\(can\)\}/);
  assert.match(card, /loanId=\{assessment\.loan_id\}/);
  assert.match(card, /creditScoreId=\{score\.id\}/);
});

test("the loan page gains exactly one import and one render line, after the documents card", () => {
  const imports = page.split("\n").filter((l) => l.includes("credit-assessment-card"));
  assert.deepEqual(imports, ['import { CreditAssessmentCard } from "./_components/credit-assessment-card";']);
  const renders = page.split("\n").filter((l) => l.includes("CreditAssessmentCard") && !l.startsWith("import"));
  assert.deepEqual(renders.map((l) => l.trim()), ["<CreditAssessmentCard loanId={loan.id} status={loan.status} />"]);
  const lines = page.split("\n");
  const at = lines.findIndex((l) => l.includes("<CreditAssessmentCard"));
  assert.match(lines[at - 1], /<LoanDocumentsCard /);
});

test("a save compares the box with how it loaded, and a disabled Record Decision says why", () => {
  assert.match(card, /assessmentBody\(form, loaded, \{ memberDetailsHidden: detailsHidden \}\)/);
  assert.match(card, /detailsHidden=\{memberDetailsHidden\(can\)\}/);
  assert.match(card, /const loaded = assessmentFormFrom\(assessment\.application_profile\)/);
  assert.match(card, /\{!score\?\.id && \(\s*<p id="assessment-decision-reason"[^>]*>\s*\{NO_SCORE_DECISION_REASON\}/);
});
