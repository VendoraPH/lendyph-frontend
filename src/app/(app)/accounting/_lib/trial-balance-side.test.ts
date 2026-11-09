import { test } from "node:test";
import assert from "node:assert/strict";
import { heavierSide, outOfBalanceMessage } from "./trial-balance-side";

test("a positive difference means debits are higher", () => {
  assert.equal(heavierSide(1500), "debit");
});

test("a negative difference means credits are higher", () => {
  assert.equal(heavierSide(-1500), "credit");
});

test("no difference has no heavier side", () => {
  assert.equal(heavierSide(0), null);
});

test("the message names the heavier side and the server's difference", () => {
  assert.equal(
    outOfBalanceMessage(123456),
    "Debits are higher than credits by ₱1,234.56. Something has been posted that should not have been.",
  );
  assert.equal(
    outOfBalanceMessage(-50),
    "Credits are higher than debits by ₱0.50. Something has been posted that should not have been.",
  );
});

test("a balanced trial balance, or a missing difference, gets no message", () => {
  assert.equal(outOfBalanceMessage(0), null);
  assert.equal(outOfBalanceMessage(undefined), null);
});
