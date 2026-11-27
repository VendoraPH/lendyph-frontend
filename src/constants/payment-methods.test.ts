import { test } from "node:test";
import assert from "node:assert/strict";
import { knownPaymentMethodName } from "./payment-methods";

test("a share capital credit moved from savings reads in words (gap round S3)", () => {
  assert.equal(knownPaymentMethodName("savings_transfer"), "Transfer from savings");
});

test("recorded-only and picked methods still read in words; an unknown one is null", () => {
  assert.equal(knownPaymentMethodName("auto_pay"), "Auto-Pay");
  assert.equal(knownPaymentMethodName("bank_transfer"), "Bank Transfer");
  assert.equal(knownPaymentMethodName("something_else"), null);
  assert.equal(knownPaymentMethodName(undefined), null);
});
