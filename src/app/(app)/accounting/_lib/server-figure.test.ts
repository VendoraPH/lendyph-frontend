import { test } from "node:test";
import assert from "node:assert/strict";
import { centavosOrDash } from "./server-figure";

test("a server figure shows as ₱ with two decimals", () => {
  assert.equal(centavosOrDash(150_050), "₱1,500.50");
  assert.equal(centavosOrDash(-2_500), "(₱25.00)");
});

test("zero shows ₱0.00 and only a missing figure shows a dash", () => {
  assert.equal(centavosOrDash(0), "₱0.00");
  assert.equal(centavosOrDash(null), "—");
  assert.equal(centavosOrDash(undefined), "—");
});
