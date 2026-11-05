import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHOD_OPTIONS,
  paymentMethodFields,
  paymentMethodLabel,
  paymentReferenceError,
  readPaymentMethod,
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
