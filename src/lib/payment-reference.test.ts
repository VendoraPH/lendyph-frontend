/**
 * How money is received or paid out, as each screen asks for it and the API
 * stores it: the method, its reference number, and the reason a missing
 * reference can't be sent.
 *
 * WHAT THIS PROVES: the method fields every screen sends (Record Payment, the
 * release, an extension on "pay", share capital entries and auto-credit); that
 * the reference is required for every method but cash, in each screen's own
 * words, with Record Payment's wording unchanged; that a changed method clears
 * the reference; and the settlement accounts auto-credit offers, Bank first.
 * WHAT IT DOES NOT PROVE: the server's rules, which the backend's tests cover.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_METHOD_OPTIONS } from "@/constants/payment-methods";
import {
  AUTO_CREDIT_DEFAULT_METHOD,
  AUTO_CREDIT_METHOD_OPTIONS,
  autoCreditMethodLabel,
  paymentMethodFields,
  paymentReferenceError,
  readAutoCreditMethod,
  referenceAfterMethodChange,
} from "./payment-reference";

test("Record Payment's wording is unchanged", () => {
  assert.equal(paymentReferenceError("gcash", ""), "Enter the reference number for this GCash payment.");
  assert.equal(
    paymentReferenceError("bank_transfer", " ", "payment"),
    "Enter the reference number for this Bank Transfer payment.",
  );
});

test("each screen says what the reference is for", () => {
  assert.equal(
    paymentReferenceError("gcash", "", "release"),
    "Enter the reference number of the GCash transfer that pays out this loan.",
  );
  assert.equal(
    paymentReferenceError("maya", "", "extension"),
    "Enter the reference number for this Maya payment collected to extend the loan.",
  );
  assert.equal(
    paymentReferenceError("online", "", "share_capital"),
    "Enter the reference number for this Online share capital entry.",
  );
});

test("a restructure's release collects its deductions, so its reference says so", () => {
  assert.equal(
    paymentReferenceError("gcash", "", "restructure_collection"),
    "Enter the reference number for this GCash collection of the restructure's deductions.",
  );
});

test("cash needs no reference on any screen", () => {
  for (const subject of ["payment", "release", "restructure_collection", "extension", "share_capital"] as const) {
    assert.equal(paymentReferenceError("cash", "", subject), null, subject);
  }
});

test("every other method needs one, on every screen", () => {
  for (const subject of ["payment", "release", "restructure_collection", "extension", "share_capital"] as const) {
    for (const method of ["gcash", "maya", "bank_transfer", "online"] as const) {
      assert.ok(paymentReferenceError(method, "   ", subject), `${subject} ${method}`);
      assert.equal(paymentReferenceError(method, "REF-1", subject), null, `${subject} ${method}`);
    }
  }
});

test("the fields carry the method and the trimmed reference, nothing for a blank one", () => {
  assert.deepEqual(paymentMethodFields("gcash", "  GC-123 "), { method: "gcash", reference_number: "GC-123" });
  assert.deepEqual(paymentMethodFields("cash", "  "), { method: "cash" });
  assert.deepEqual(paymentMethodFields("bank_transfer", ""), { method: "bank_transfer" });
});

test("changing the method clears the reference; picking it again keeps it", () => {
  assert.equal(referenceAfterMethodChange("gcash", "cash", "GC-123"), "");
  assert.equal(referenceAfterMethodChange("bank_transfer", "gcash", "BT-1"), "");
  assert.equal(referenceAfterMethodChange("gcash", "gcash", "GC-123"), "GC-123");
});

test("auto-credit settles through Bank by default", () => {
  assert.equal(AUTO_CREDIT_DEFAULT_METHOD, "bank_transfer");
  assert.equal(autoCreditMethodLabel(AUTO_CREDIT_DEFAULT_METHOD), "Bank");
});

test("auto-credit offers the accounts the API accepts, in the shared list's words", () => {
  assert.deepEqual(
    AUTO_CREDIT_METHOD_OPTIONS.map((o) => o.value),
    ["bank_transfer", "cash", "gcash", "maya"],
  );
  for (const option of AUTO_CREDIT_METHOD_OPTIONS) {
    if (option.value === "bank_transfer") continue;
    assert.equal(option.label, PAYMENT_METHOD_OPTIONS.find((o) => o.value === option.value)?.label);
  }
});

test("a value auto-credit can't offer keeps the current account", () => {
  assert.equal(readAutoCreditMethod("gcash", "bank_transfer"), "gcash");
  assert.equal(readAutoCreditMethod("online", "bank_transfer"), "bank_transfer");
  assert.equal(readAutoCreditMethod(null, "cash"), "cash");
});
