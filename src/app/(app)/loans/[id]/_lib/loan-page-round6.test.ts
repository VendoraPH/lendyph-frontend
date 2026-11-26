/**
 * The loan page items of finish run round 6, pinned in the page's source (no
 * DOM here; the lead's browser check at 390 px confirms the layout):
 * - the Release Details header lets its title wrap and gives the Statement of
 *   Account button a short label on a phone, so the button is never cut off;
 * - the "Approval chain unavailable" note names the status the badge shows
 *   ("Past Due" where the badge says Past Due), never the stored status.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

test("the Statement of Account button keeps its full name and fits at 390 px", () => {
  assert.match(page, /aria-label="Statement of Account"/);
  assert.match(page, /<span className="sm:hidden">Statement<\/span>/);
  assert.match(page, /<span className="hidden sm:inline">Statement of Account<\/span>/);
  assert.match(page, /<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">\s*Release Details/);
});

test("the approval note reads the status the badge shows", () => {
  assert.match(page, /This loan is \{LOAN_STATUS_LABELS\[displayStatus\] \?\? displayStatus\}, but its approval/);
  assert.doesNotMatch(page, /This loan is \{LOAN_STATUS_LABELS\[loan\.status\]/);
});
