import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptImageFileName } from "./receipt-image";

test("receiptImageFileName names the PNG after the receipt number", () => {
  assert.equal(receiptImageFileName("OR-00000123"), "receipt-OR-00000123.png");
});

test("receiptImageFileName replaces characters a file name can't hold", () => {
  assert.equal(receiptImageFileName(" OR/2026 #15 "), "receipt-OR-2026-15.png");
  assert.equal(receiptImageFileName("///"), "receipt-payment.png");
});
