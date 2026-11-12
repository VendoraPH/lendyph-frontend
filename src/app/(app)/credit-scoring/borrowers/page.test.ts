/**
 * Member Scores, read from source: without loans:view the loan facts arrive
 * null and read a dash, and their filters are never sent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/credit-scoring/borrowers/page.tsx"), "utf8");

test("the loan facts read a dash when null", () => {
  assert.match(page, /<TableCell>\{yesNoOrDash\(row\.has_active_loan\)\}<\/TableCell>/);
  assert.match(page, /<TableCell>\{yesNoOrDash\(row\.past_due\)\}<\/TableCell>/);
  assert.doesNotMatch(page, /\? "Yes" : "No"/);
});

test("the list's filters pass the loans:view gate before they're sent", () => {
  assert.match(page, /listBorrowerScores\(borrowerScoreFilters\(filters, canViewLoans\), \{ page, per_page: perPage \}\)/);
  assert.match(page, /const canViewLoans = can\("loans:view"\)/);
});

test("the search box asks the server once typing settles, from page one, never filtering rows itself", () => {
  assert.match(page, /<Input\s+id="member-score-search"\s+type="search"/);
  assert.match(page, /setSearch\(searchInput\);\s*setPage\(1\);\s*\}, SEARCH_DEBOUNCE_MS\)/);
  assert.match(page, /search: memberSearchParam\(search\),/);
  assert.doesNotMatch(page, /res\.data\.filter\(|\.data\.filter\(/);
});

test("the Outstanding column shows the server's ₱ figure, or a dash when it's null", () => {
  assert.match(page, /<TableHead className="text-right">Outstanding<\/TableHead>/);
  assert.match(page, /<TableCell className="text-right tabular-nums">\{pesosOrDash\(row\.outstanding\)\}<\/TableCell>/);
});

test("trend, member type and loan product are filters; the loan product one only for loans:view", () => {
  assert.match(page, /trend: optionParam<ScoreTrend>\(trend\),/);
  assert.match(page, /member_type: optionParam<MemberType>\(memberType\),/);
  assert.match(page, /loan_product_id: loanProductParam\(loanProduct\),/);
  assert.match(page, /\{canViewLoans && \(\s*<LoanProductFilter/);
  assert.match(page, /<TrendFilter/);
  assert.match(page, /<MemberTypeFilter/);
});
