/**
 * The Auto-Pay dialog's own check of the CBS reference, before it asks the
 * server.
 *
 * WHAT THIS PROVES: turning Auto-Pay on with no reference (or only spaces)
 * reads the server's wording; a reference, or turning it off, passes.
 * WHAT IT DOES NOT PROVE: the server's rule (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTO_PAY_REFERENCE_REQUIRED, autoPayReferenceError } from "./auto-pay-reference";

test("turning Auto-Pay on with no CBS reference reads the server's wording", () => {
  assert.equal(AUTO_PAY_REFERENCE_REQUIRED, "Enter the CBS reference to turn Auto-Pay on.");
  assert.equal(autoPayReferenceError(true, ""), AUTO_PAY_REFERENCE_REQUIRED);
  assert.equal(autoPayReferenceError(true, "   "), AUTO_PAY_REFERENCE_REQUIRED);
});

test("a reference, or turning Auto-Pay off, passes", () => {
  assert.equal(autoPayReferenceError(true, "CBS-001"), null);
  assert.equal(autoPayReferenceError(false, ""), null);
});

test("the dialog uses it and keeps its field label", () => {
  const dialog = readFileSync(join(process.cwd(), "src/components/auto-pay-toggle-dialog.tsx"), "utf8");
  assert.ok(dialog.includes("autoPayReferenceError(enabled, cbsReference)"));
  assert.ok(!dialog.includes("is required when enabling Auto-Pay"));
  assert.ok(dialog.includes("CBS Reference No."));
});
