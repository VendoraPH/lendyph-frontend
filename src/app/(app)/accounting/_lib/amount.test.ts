import { test } from "node:test";
import assert from "node:assert/strict";
import { amountDisplay } from "./amount";

test("a figure shows in pesos with two decimals", () => {
  assert.deepEqual(amountDisplay(150050), { text: "₱1,500.50", negative: false });
});

test("zero shows ₱0.00, never a dash", () => {
  assert.deepEqual(amountDisplay(0), { text: "₱0.00", negative: false });
});

test("a negative figure shows in parentheses", () => {
  assert.deepEqual(amountDisplay(-2500), { text: "(₱25.00)", negative: true });
});

test("a figure the server didn't send shows a dash", () => {
  assert.deepEqual(amountDisplay(undefined), { text: "—", negative: false });
  assert.deepEqual(amountDisplay(null), { text: "—", negative: false });
  assert.deepEqual(amountDisplay(Number.NaN), { text: "—", negative: false });
});
