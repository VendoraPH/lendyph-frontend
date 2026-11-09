/**
 * The Application Details form's locks, read from source: while member
 * details are hidden, every text field and both Selects read "Hidden (needs
 * access to member details)" and are disabled. Which fields are hidden is
 * tested in src/lib/credit-scoring/assessment-card.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const form = readFileSync(
  join(process.cwd(), "src/app/(app)/credit-scoring/_components/assessment-form.tsx"),
  "utf8",
);

test("text fields lock and read the hidden text while member details are hidden", () => {
  assert.match(form, /const hidden = memberDetailHidden\(f\.key, detailsHidden\)/);
  assert.match(form, /placeholder=\{hidden \? MEMBER_DETAILS_HIDDEN_TEXT : undefined\}/);
  assert.match(form, /disabled=\{!canSave \|\| hidden\}/);
});

test("employment status and income verification lock and read the hidden text too", () => {
  for (const [name, field] of [
    ["employment", "employment_status"],
    ["verification", "income_verification"],
  ]) {
    assert.match(form, new RegExp(`const ${name}Hidden = memberDetailHidden\\("${field}", detailsHidden\\)`));
    assert.match(form, new RegExp(`const ${name}Items = choicesFor\\(`));
    assert.match(form, new RegExp(`value=\\{${name}Hidden \\? HIDDEN_CHOICE : form\\.${field} \\|\\| NONE\\}`));
    assert.match(form, new RegExp(`items=\\{${name}Items\\}\\s*disabled=\\{!canSave \\|\\| ${name}Hidden\\}`));
  }
});
