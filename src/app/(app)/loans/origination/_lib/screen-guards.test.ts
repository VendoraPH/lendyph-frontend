/**
 * Layout and naming rules for the staff loan origination screens, read from
 * their source:
 * - at 1024×640 a page fits the screen, and a fixed row above its scroll box
 *   keeps its height (`shrink-0`); a row that scrolls sideways would
 *   otherwise shrink and clip its 32 px chips;
 * - a handed-off application offers "Open loan" once, in its action row;
 * - every chip's remove button names what it removes;
 * - a term reads its unit from the application or the assessment
 *   (`term_unit`), so no page reads the loan products for it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/(app)/loans/origination");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

test("the status chip row keeps its height in a fit-to-screen column", () => {
  assert.match(read("_components/status-tabs.tsx"), /className="[^"]*\bshrink-0\b[^"]*"\s+role="group"/);
});

test("every filter row above a list keeps its height", () => {
  assert.match(read("_components/application-filters.tsx"), /<div className="grid shrink-0 /);
  assert.match(read("documents/page.tsx"), /<div className="flex shrink-0 flex-wrap items-center gap-3">/);
  assert.match(read("assessments/page.tsx"), /<div className="flex shrink-0 flex-wrap items-center gap-3">/);
  assert.match(read("links/page.tsx"), /<div className="flex shrink-0 justify-end">/);
});

test("a handed-off application offers Open loan once, in its action row", () => {
  assert.doesNotMatch(read("applications/[id]/page.tsx"), /Open loan/);
  assert.equal(read("applications/[id]/_components/application-actions.tsx").match(/Open loan/g)?.length, 1);
});

test("a term reads its unit from the application or the assessment, with no products request", () => {
  for (const page of ["applications/[id]/page.tsx", "assessments/page.tsx"]) {
    assert.doesNotMatch(read(page), /useLoanProducts|termUnitOf/);
  }
  assert.match(read("applications/[id]/_components/applicant-overview.tsx"), /termText\(a\.requested_term, a\.term_unit\)/);
  assert.match(read("_components/assessment-report.tsx"), /termText\(a\.requested_term, a\.term_unit\)/);
});

test("each required-field chip's remove button names the field", () => {
  const select = read("settings/_components/required-fields-select.tsx");
  assert.match(select, /<ComboboxChip[^>]*showRemove=\{false\}/);
  assert.match(select, /aria-label=\{`Remove \$\{o\.label\}`\}/);
});
