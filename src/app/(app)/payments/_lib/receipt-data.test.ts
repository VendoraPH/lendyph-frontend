import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPaymentToReceipt, receiptImageFileName, receiptShareUrl } from "./receipt-data";
import type { Repayment } from "@/types";

test("receiptImageFileName names the PNG after the receipt number", () => {
  assert.equal(receiptImageFileName("OR-00000123"), "receipt-OR-00000123.png");
});

test("receiptImageFileName replaces characters a file name can't hold", () => {
  assert.equal(receiptImageFileName(" OR/2026 #15 "), "receipt-OR-2026-15.png");
  assert.equal(receiptImageFileName("///"), "receipt-payment.png");
});

test("receiptShareUrl builds the public link on the current deployment", () => {
  assert.equal(receiptShareUrl("https://app.lendy.ph", "abc123"), "https://app.lendy.ph/receipts/abc123");
  assert.equal(receiptShareUrl("https://app.lendy.ph/", "a b"), "https://app.lendy.ph/receipts/a%20b");
});

test("mapPaymentToReceipt reads a public receipt that omits the staff-only fields", () => {
  const publicPayload = {
    id: 0,
    receipt_number: "OR-00000042",
    payment_date: "2026-11-20",
    method: "gcash",
    reference_number: "••••5678",
    amount_paid: 1500,
    principal_amount: 1200,
    interest_amount: 300,
    status: "voided",
    borrower_name: "Juan Dela Cruz",
    loan_account_number: "••••0042",
    loan_product_name: "Salary Loan",
  } as unknown as Repayment;

  const receipt = mapPaymentToReceipt(publicPayload);
  assert.equal(receipt.receipt_number, "OR-00000042");
  assert.equal(receipt.loan_account_number, "••••0042");
  assert.equal(receipt.reference_number, "••••5678");
  assert.equal(receipt.status, "voided");
  assert.equal(receipt.collected_by, "—");
  assert.equal(receipt.remarks, "");
});

test("mapPaymentToReceipt drops a null reference number", () => {
  const receipt = mapPaymentToReceipt({ id: 7, amount_paid: 10, status: "completed", reference_number: null } as unknown as Repayment);
  assert.equal(receipt.reference_number, undefined);
  assert.equal(receipt.receipt_number, "OR-00000007");
});
