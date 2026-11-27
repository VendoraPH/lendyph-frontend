import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("the loan page shows the penalty terms only while penalty configurations are on", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.match(page, /\{env\.features\.penaltyConfigs && \(\s*<div>\s*<p className="text-xs text-muted-foreground">Penalty<\/p>\s*<PenaltyTerms loan=\{loan\}/);
  assert.equal(page.match(/<PenaltyTerms /g)?.length, 1);
});
