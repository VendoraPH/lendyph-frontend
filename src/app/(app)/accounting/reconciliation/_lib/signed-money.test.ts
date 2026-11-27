import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCentavos } from "@/lib/accounting/money";
import { signedCentavos } from "./signed-money";

test("a negative figure reads in parentheses, as the accounting statements show it", () => {
  assert.equal(signedCentavos(-40_000), "(₱400.00)");
  assert.equal(signedCentavos(-123_456_789), "(₱1,234,567.89)");
});

test("a positive figure and zero read as ₱ with two decimals, the same as formatCentavos", () => {
  for (const centavos of [150_050, 0, 1, 99_999_999]) {
    assert.equal(signedCentavos(centavos), formatCentavos(centavos));
  }
  assert.equal(signedCentavos(0), "₱0.00");
});
