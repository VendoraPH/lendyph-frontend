/**
 * The Auto-Credit confirm dialog's wiring, pinned in the page source (no DOM
 * in this suite).
 *
 * WHAT THIS PROVES: a refused run (422 on the method or reference, or the 409
 * that posted nothing) shows the server's own words; and the dialog can't be
 * closed while the run posts.
 * WHAT IT DOES NOT PROVE: the run itself (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/share-capital/auto-credit/page.tsx"), "utf8");

test("a refused run shows the server's message", () => {
  assert.ok(page.includes('notifyError(err, "We couldn\'t process auto-credit. Please try again.")'));
  assert.ok(!page.includes('toast.error("We couldn\'t process auto-credit. Please try again.")'));
});

test("the confirm dialog can't close while the run posts", () => {
  assert.match(page, /onOpenChange=\{\(open\) => \{\s*if \(!processing\) setConfirmOpen\(open\);\s*\}\}/);
});
