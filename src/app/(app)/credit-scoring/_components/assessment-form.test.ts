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

test("hidden member details show no field, and the notice only once on the page", () => {
  assert.match(form, /\{detailsHidden \? \(\s*showHiddenNotice && <DetailsHiddenNotice \/>\s*\) : \(\s*<div className="grid gap-4 sm:grid-cols-2">/);
  assert.match(form, /showHiddenNotice = true,/);
  assert.doesNotMatch(form, /MEMBER_DETAILS_HIDDEN_TEXT|HIDDEN_CHOICE/);
});

test("a caller who can't see the details is offered only the notice acknowledgement", () => {
  assert.match(form, /\{detailsHidden \? ONLY_NOTICE_TEXT : "Optional\. Saving scores this application again\. Leave a field empty to clear it\."\}/);
});
