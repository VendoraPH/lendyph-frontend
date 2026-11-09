/**
 * The loan page's document upload, pinned in its source (no DOM here).
 *
 * WHAT THIS PROVES: a refused upload (a 422 on the file's type or size) shows
 * the server's own words, with the generic text only when there are none.
 * WHAT IT DOES NOT PROVE: the server's rules (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const card = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/_components/loan-documents-card.tsx"), "utf8");

test("a refused upload shows the server's message", () => {
  assert.ok(card.includes('notifyError(err, "We couldn\'t upload the document. Please try again.")'));
  assert.ok(!card.includes('toast.error("We couldn\'t upload the document. Please try again.")'));
});
