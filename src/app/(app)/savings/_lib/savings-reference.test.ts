import { test } from "node:test";
import assert from "node:assert/strict";
import { referenceLabel, referenceNeeded, savingsReferenceError } from "./savings-reference";

test("bank transfer, GCash and Maya need a reference; cash and a move from savings don't", () => {
  for (const method of ["bank_transfer", "gcash", "maya"] as const) assert.equal(referenceNeeded(method), true, method);
  for (const method of ["cash", "savings", "", null, undefined] as const) assert.equal(referenceNeeded(method), false, String(method));
});

test("nothing paid (an opening deposit of ₱0.00) needs no reference, whatever the method", () => {
  assert.equal(referenceNeeded("gcash", false), false);
  assert.equal(savingsReferenceError("gcash", "", "opening_deposit", false), null);
});

test("a blank reference reads the server's words for the method and the entry", () => {
  assert.equal(savingsReferenceError("gcash", "", "deposit"), "Enter the GCash reference for this deposit.");
  assert.equal(savingsReferenceError("bank_transfer", "   ", "withdrawal"), "Enter the bank transfer reference for this withdrawal.");
  assert.equal(savingsReferenceError("maya", "", "opening_deposit"), "Enter the Maya reference for the opening deposit.");
  assert.equal(savingsReferenceError("gcash", "", "time_deposit"), "Enter the GCash reference for this time deposit.");
  assert.equal(savingsReferenceError("bank_transfer", "", "payout"), "Enter the bank transfer reference for this payout.");
});

test("a typed reference, cash and a move from savings pass", () => {
  assert.equal(savingsReferenceError("gcash", " GC-1 ", "deposit"), null);
  assert.equal(savingsReferenceError("cash", "", "deposit"), null);
  assert.equal(savingsReferenceError("savings", "", "time_deposit"), null);
  assert.equal(savingsReferenceError("", "", "payout"), null);
});

test("the label says optional only where a blank reference is accepted", () => {
  assert.equal(referenceLabel(true), "Reference");
  assert.equal(referenceLabel(false), "Reference (optional)");
});
