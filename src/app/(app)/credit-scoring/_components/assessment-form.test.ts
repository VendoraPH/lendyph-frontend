/**
 * The Application Details form, read from source: while member details are
 * hidden it shows one notice in place of the fields, so none of them shows or
 * can be typed. That they're never sent is tested in
 * src/lib/credit-scoring/assessment-card.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const form = readFileSync(
  join(process.cwd(), "src/app/(app)/credit-scoring/_components/assessment-form.tsx"),
  "utf8",
);

test("hidden member details show the notice in place of every field", () => {
  assert.match(form, /\{detailsHidden \? \(\s*<DetailsHiddenNotice \/>\s*\) : \(\s*<div className="grid gap-4 sm:grid-cols-2">/);
  assert.doesNotMatch(form, /MEMBER_DETAILS_HIDDEN_TEXT|HIDDEN_CHOICE/);
});
