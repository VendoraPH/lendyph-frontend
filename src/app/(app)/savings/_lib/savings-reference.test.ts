import { test } from "node:test";
import assert from "node:assert/strict";
import {
  counterReferenceRule,
  payoutReferenceField,
  referenceLabel,
  referenceNeeded,
  savingsReferenceError,
} from "./savings-reference";

test("bank transfer, GCash and Maya need a reference; cash and a move from savings don't", () => {
  for (const method of ["bank_transfer", "gcash", "maya"] as const) assert.equal(referenceNeeded(method), true, method);
  for (const method of ["cash", "savings", "", null, undefined] as const) assert.equal(referenceNeeded(method), false, String(method));
});

test("nothing paid (an opening deposit of ₱0.00) needs no reference, whatever the method", () => {
  assert.equal(referenceNeeded("gcash", false), false);
  assert.equal(savingsReferenceError("gcash", "", "opening_deposit", false), null);
});

test("a blank reference for money coming in reads the server's words for the method and the entry", () => {
  assert.equal(savingsReferenceError("gcash", "", "deposit"), "Enter the GCash reference for this deposit.");
  assert.equal(savingsReferenceError("bank_transfer", "   ", "deposit"), "Enter the bank transfer reference for this deposit.");
  assert.equal(savingsReferenceError("maya", "", "opening_deposit"), "Enter the Maya reference for the opening deposit.");
  assert.equal(savingsReferenceError("gcash", "", "time_deposit"), "Enter the GCash reference for this time deposit.");
});

test("a typed reference, cash and a move from savings pass", () => {
  assert.equal(savingsReferenceError("gcash", " GC-1 ", "deposit"), null);
  assert.equal(savingsReferenceError("cash", "", "deposit"), null);
  assert.equal(savingsReferenceError("savings", "", "time_deposit"), null);
});

test("the label says optional only where a blank reference is accepted", () => {
  assert.equal(referenceLabel(true), "Reference");
  assert.equal(referenceLabel(false), "Reference (optional)");
});

test("at the counter a deposit by a non-cash method needs its reference; a withdrawal never does", () => {
  assert.deepEqual(counterReferenceRule("deposit", "gcash", " "), {
    needed: true,
    problem: "Enter the GCash reference for this deposit.",
  });
  assert.deepEqual(counterReferenceRule("deposit", "cash", ""), { needed: false, problem: null });
  // Money going out: its reference exists only once it is sent, after any approval.
  for (const method of ["cash", "bank_transfer", "gcash", "maya"] as const) {
    assert.deepEqual(counterReferenceRule("withdrawal", method, ""), { needed: false, problem: null }, method);
  }
});

test("a payout sends its typed reference as payout_reference; into savings or blank sends none", () => {
  assert.deepEqual(payoutReferenceField("gcash", " GC-1 "), { payout_reference: "GC-1" });
  assert.deepEqual(payoutReferenceField("cash", "OR-7"), { payout_reference: "OR-7" });
  assert.deepEqual(payoutReferenceField("gcash", "  "), {});
  assert.deepEqual(payoutReferenceField("savings", "MEMO"), {});
});
