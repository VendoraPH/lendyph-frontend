/**
 * The list filters, read from source: loan products load only for loans:view,
 * and every dropdown reads in words.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/(app)/credit-scoring/_components/filters.tsx"), "utf8");

test("the loan products for the filter are asked for only with loans:view", () => {
  assert.match(source, /const canViewLoans = can\("loans:view"\);/);
  assert.match(source, /useApiResource<LoanProduct\[\]>\(fetcher, canViewLoans\)/);
});

test("the trend and member type dropdowns use the words, never the keys", () => {
  assert.match(source, /SCORE_TREND_LABELS\[trend\]/);
  assert.match(source, /MEMBER_TYPE_LABELS\[type\]/);
  assert.match(source, /label: "All trends"/);
  assert.match(source, /label: "All member types"/);
  assert.match(source, /label: "All loan products"/);
});
