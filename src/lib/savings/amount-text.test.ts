import { test } from "node:test";
import assert from "node:assert/strict";
import { isNilAmount } from "./amount-text";

test("a zero figure in any of the server's forms is nothing", () => {
  for (const value of ["0.00", "0", "0.0", "", " ", ".00", null, undefined]) {
    assert.equal(isNilAmount(value), true, String(value));
  }
});

test("any non-zero figure is something", () => {
  for (const value of ["0.01", "10.00", "1500.50", "100"]) {
    assert.equal(isNilAmount(value), false, value);
  }
});
