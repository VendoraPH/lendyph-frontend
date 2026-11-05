import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaymentBody, referenceAfterMethodChange } from "./payment-body";

const base = {
  paymentDate: "2026-11-05",
  amount: 1500,
  method: "cash",
  referenceNumber: "",
  remarks: "",
  collectedBy: "Ana Reyes",
  signedInName: "Ana Reyes",
};

// New Payment used to keep the method only in the remarks, so a GCash payment
// was stored as cash and posted to the cash account.
test("the method and reference number are sent as fields", () => {
  const body = buildPaymentBody({ ...base, method: "gcash", referenceNumber: " GC-123 " });

  assert.equal(body.method, "gcash");
  assert.equal(body.reference_number, "GC-123");
  assert.equal(body.payment_date, "2026-11-05");
  assert.equal(body.amount_paid, 1500);
});

test("cash with no reference sends a null reference", () => {
  const body = buildPaymentBody(base);

  assert.equal(body.method, "cash");
  assert.equal(body.reference_number, null);
});

test("the old bracketed line is never written to the remarks", () => {
  const body = buildPaymentBody({
    ...base,
    method: "gcash",
    referenceNumber: "GC-123",
    remarks: "Paid at the branch",
    collectedBy: "Ben Cruz",
  });

  assert.equal(body.remarks?.includes("["), false);
  assert.equal(body.remarks?.includes("method="), false);
  assert.equal(body.remarks?.includes("collected_by="), false);
});

test("no remarks and the signed-in collector send no remarks", () => {
  assert.equal(buildPaymentBody(base).remarks, undefined);
});

test("the signed-in collector adds nothing to the typed remarks", () => {
  assert.equal(buildPaymentBody({ ...base, remarks: " Paid early " }).remarks, "Paid early");
});

test("another collector is written as plain text", () => {
  assert.equal(buildPaymentBody({ ...base, collectedBy: " Ben Cruz " }).remarks, "Collected by Ben Cruz");
});

test("another collector follows the typed remarks", () => {
  assert.equal(
    buildPaymentBody({ ...base, remarks: "Paid early", collectedBy: "Ben Cruz" }).remarks,
    "Paid early\nCollected by Ben Cruz",
  );
});

test("a blank collector or a case difference is not another collector", () => {
  assert.equal(buildPaymentBody({ ...base, collectedBy: "  " }).remarks, undefined);
  assert.equal(buildPaymentBody({ ...base, collectedBy: "ana reyes" }).remarks, undefined);
});

// A reference typed for GCash must not go out on a Cash payment. Cash takes no
// required reference, so nothing else would stop it.
test("changing the method clears the reference", () => {
  assert.equal(referenceAfterMethodChange("gcash", "cash", "GC-123"), "");
  assert.equal(referenceAfterMethodChange("gcash", "maya", "GC-123"), "");
  assert.equal(referenceAfterMethodChange("cash", "gcash", "OR-9"), "");
});

test("picking the same method again keeps the reference", () => {
  assert.equal(referenceAfterMethodChange("gcash", "gcash", "GC-123"), "GC-123");
});

test("the New Payment form's method select clears the reference through it", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/payments/page.tsx"), "utf8");
  assert.match(page, /setReferenceNumber\(\(current\) => referenceAfterMethodChange\(paymentMethod, value, current\)\)/);
});
