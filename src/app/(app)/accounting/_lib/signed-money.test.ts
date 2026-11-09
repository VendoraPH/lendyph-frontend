import { test } from "node:test";
import assert from "node:assert/strict";
import { signedCentavos, signedCentavosOrDash } from "./signed-money";

test("a negative figure reads in parentheses, as the statements show it", () => {
  assert.equal(signedCentavos(-40_000), "(₱400.00)");
  assert.equal(signedCentavos(-123_456_789), "(₱1,234,567.89)");
});

test("a positive figure and zero read as ₱ with two decimals", () => {
  assert.equal(signedCentavos(150_050), "₱1,500.50");
  assert.equal(signedCentavos(0), "₱0.00");
});

test("a missing figure reads as a dash, never ₱0.00", () => {
  assert.equal(signedCentavosOrDash(null), "—");
  assert.equal(signedCentavosOrDash(undefined), "—");
  assert.equal(signedCentavosOrDash(Number.NaN), "—");
  assert.equal(signedCentavosOrDash(-2_500), "(₱25.00)");
  assert.equal(signedCentavosOrDash(0), "₱0.00");
});

test("a decimal-cast string reads as the number it carries", () => {
  assert.equal(signedCentavosOrDash("-150050"), "(₱1,500.50)");
  assert.equal(signedCentavosOrDash(""), "—");
  assert.equal(signedCentavosOrDash("abc"), "—");
});
