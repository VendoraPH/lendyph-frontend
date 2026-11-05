import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodFields,
  paymentMethodLabel,
  paymentReferenceError,
  readPaymentMethod,
  referenceAfterMethodChange,
} from "./payment-method";

test("Record Payment defaults to Cash", () => {
  assert.equal(DEFAULT_PAYMENT_METHOD, "cash");
  assert.equal(paymentMethodLabel(DEFAULT_PAYMENT_METHOD), "Cash");
});

test("the window offers exactly the methods the API accepts", () => {
  assert.deepEqual(
    PAYMENT_METHOD_OPTIONS.map((o) => o.value),
    ["cash", "gcash", "maya", "bank_transfer", "online"],
  );
});

test("a value the select can't offer falls back to the current method", () => {
  assert.equal(readPaymentMethod("gcash", "cash"), "gcash");
  assert.equal(readPaymentMethod("auto_pay", "cash"), "cash");
  assert.equal(readPaymentMethod(null, "maya"), "maya");
});

test("cash needs no reference number", () => {
  assert.equal(paymentReferenceError("cash", ""), null);
  assert.equal(paymentReferenceError("cash", "   "), null);
});

test("every other method needs one", () => {
  for (const method of ["gcash", "maya", "bank_transfer", "online"] as const) {
    assert.ok(paymentReferenceError(method, "  "), method);
    assert.equal(paymentReferenceError(method, "REF-1"), null);
  }
});

test("the payment carries the method and the trimmed reference", () => {
  assert.deepEqual(paymentMethodFields("gcash", "  GC-123 "), { method: "gcash", reference_number: "GC-123" });
});

test("a cash payment with nothing typed sends no reference", () => {
  assert.deepEqual(paymentMethodFields("cash", "  "), { method: "cash" });
  assert.deepEqual(paymentMethodFields("cash", "OR-9"), { method: "cash", reference_number: "OR-9" });
});

test("changing the method clears the reference typed for the old one", () => {
  assert.equal(referenceAfterMethodChange("gcash", "cash", "GC-123"), "");
  assert.equal(referenceAfterMethodChange("gcash", "maya", "GC-123"), "");
  assert.equal(referenceAfterMethodChange("cash", "gcash", "OR-9"), "");
});

test("picking the same method again keeps the reference", () => {
  assert.equal(referenceAfterMethodChange("gcash", "gcash", "GC-123"), "GC-123");
});

test("the loan page clears the method and reference every time the window opens", () => {
  // A page-level wiring the unit tests can't render (no DOM here), so it is
  // pinned in the source: Cancel keeps the fields, and opening clears them, so a
  // later cash payment can't post as GCash with an old reference.
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.match(
    page,
    /if \(useDialogOpening\(recordPaymentOpen, loanId\)\) \{\s*setPaymentMethod\(DEFAULT_PAYMENT_METHOD\);\s*setPaymentReference\(""\);\s*\}/,
  );
});

test("the loan page clears the reference when the method changes", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.ok(page.includes("referenceAfterMethodChange(paymentMethod, next, paymentReference)"));
});
