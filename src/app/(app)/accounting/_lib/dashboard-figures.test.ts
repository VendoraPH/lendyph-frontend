import { test } from "node:test";
import assert from "node:assert/strict";
import { centavosOrDash } from "./dashboard-figures";

test("a figure shows ₱ with two decimals, and zero shows ₱0.00", () => {
  assert.equal(centavosOrDash(150_050), "₱1,500.50");
  assert.equal(centavosOrDash(0), "₱0.00");
  assert.equal(centavosOrDash(-1_050), "-₱10.50");
});

test("a missing figure shows a dash", () => {
  assert.equal(centavosOrDash(null), "—");
  assert.equal(centavosOrDash(undefined), "—");
});

test("a decimal-cast string is read as the number it carries", () => {
  assert.equal(centavosOrDash("150050" as unknown as number), "₱1,500.50");
  assert.equal(centavosOrDash("" as unknown as number), "—");
  assert.equal(centavosOrDash("abc" as unknown as number), "—");
});
