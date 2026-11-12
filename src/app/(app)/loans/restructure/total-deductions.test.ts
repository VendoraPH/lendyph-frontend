import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { currencyOrDash } from "@/lib/report-format";
import { proceedsFigures } from "@/lib/restructure-proceeds";
import type { LoanFormPreviewDeductions } from "@/types/loan";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

// POST /loans/preview sends `total_deductions: null` when a configured fee
// can't be worked out. The forms show a dash then, never ₱0.00.
test("the form preview's Total Deductions may be null", () => {
  const nullable: LoanFormPreviewDeductions["total_deductions"] = null;
  assert.equal(nullable, null);
  assert.match(read("src/types/loan.ts"), /\n {2}total_deductions: number \| null;\n {2}\/\*\* Null when `error` is set\. \*\/\n {2}net_proceeds/);
});

test("the new-loan form shows a dash for a null Total Deductions", () => {
  assert.equal(currencyOrDash(null), "—");
  assert.match(read("src/app/(app)/loans/new/page.tsx"), /\{currencyOrDash\(previewDeductions\?\.total_deductions\)\}/);
  assert.equal(proceedsFigures(false, { totalDeductions: null, netProceeds: null })[0].amount, null);
});

test("the restructure form shows a dash for a null Total Deductions", () => {
  const page = read("src/app/(app)/loans/restructure/page.tsx");
  assert.match(page, /previewDeductions\?\.total_deductions == null\s*\?\s*"—"\s*:\s*formatDeduction\(previewDeductions\.total_deductions\)/);
  assert.doesNotMatch(page, /previewDeductions \? formatDeduction\(previewDeductions\.total_deductions\) : "—"/);
});
