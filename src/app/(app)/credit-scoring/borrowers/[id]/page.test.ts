/**
 * The member's credit profile, read from source: a summary-only answer (the
 * profile's or the policy flags' `details_hidden`) shows the score, band and
 * recommendation with one notice, never the flags or capacity sections.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/credit-scoring/borrowers/[id]/page.tsx"), "utf8");

test("a summary-only profile skips the flags and capacity sections", () => {
  assert.match(page, /const summaryOnly = isDetailsHidden\(profile, flagsResource\.data\)/);
  assert.match(page, /\{summaryOnly \? null : flagsResource\.unavailable \|\| flagsResource\.error \?/);
  assert.match(page, /flagsResource\.data\.data\.length > 0 && <PolicyFlagAlert flags=\{flagsResource\.data\.data\} \/>/);
  assert.match(page, /<ScoreDetail score=\{profile\} detailsHidden=\{summaryOnly\} \/>/);
  assert.match(page, /\{!summaryOnly && profile\.status !== "not_scored" && \(/);
});
