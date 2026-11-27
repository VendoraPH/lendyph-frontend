import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEditLoanId } from "./edit-loan-id";

test("a positive id is edit mode for that loan", () => {
  assert.equal(parseEditLoanId("2"), 2);
  assert.equal(parseEditLoanId("150"), 150);
});

test("no ?edit is a new application", () => {
  assert.equal(parseEditLoanId(null), null);
  assert.equal(parseEditLoanId(""), null);
});

test("an id that is not a positive number is a new application", () => {
  for (const raw of ["abc", "0", "-3", "Infinity", "NaN"]) {
    assert.equal(parseEditLoanId(raw), null, raw);
  }
});
