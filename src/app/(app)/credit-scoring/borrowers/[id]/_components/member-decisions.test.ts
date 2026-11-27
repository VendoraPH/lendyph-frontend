/**
 * The member's decisions, read from source: paged on the server, newest first
 * as sent, through the same rows as a loan's decisions (a summary caller's
 * rows have no reason or remarks, and show neither).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/credit-scoring/borrowers/[id]/_components/member-decisions.tsx"),
  "utf8",
);

test("decisions page on the server and reuse the decision rows", () => {
  assert.match(source, /creditScoringService\.listBorrowerDecisions\(borrowerId, \{ page, per_page: perPage \}\)/);
  assert.match(source, /<DecisionItems decisions=\{res\.data\} showLoan \/>/);
  assert.match(source, /<TablePagination/);
  assert.match(source, /emptyMessage="No decisions recorded for this member\."/);
  assert.doesNotMatch(source, /\.sort\(|\.filter\(/);
});
