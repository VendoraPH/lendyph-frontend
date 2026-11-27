import { test } from "node:test";
import assert from "node:assert/strict";
import { paidBeforeImportNote } from "./paid-before-import";

test("Total Paid on an imported loan says what was paid before the import, from the server's figure", () => {
  assert.equal(paidBeforeImportNote(23600), "Including ₱23,600.00 paid before the import");
  // The Member Portal sends two-decimal strings.
  assert.equal(paidBeforeImportNote("23600.00"), "Including ₱23,600.00 paid before the import");
  assert.equal(paidBeforeImportNote(10.5), "Including ₱10.50 paid before the import");
});

test("a loan that was not imported, or a figure the server did not send, adds no words", () => {
  for (const value of [0, "0.00", null, undefined, "", "abc"]) {
    assert.equal(paidBeforeImportNote(value), null, String(value));
  }
});
