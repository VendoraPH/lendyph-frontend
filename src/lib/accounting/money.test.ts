import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toCentavos,
  fromCentavos,
  formatCentavos,
  sumCentavos,
  isBalanced,
} from "./money";

test("parses a plain peso amount", () => {
  assert.equal(toCentavos("1500.50"), 150050);
});

test("parses grouped input the way a person types it", () => {
  assert.equal(toCentavos("1,500.50"), 150050);
  assert.equal(toCentavos("₱1,500.50"), 150050);
  assert.equal(toCentavos(" 1 500.50 "), 150050);
});

test("accepts numbers as well as strings", () => {
  assert.equal(toCentavos(1500.5), 150050);
  assert.equal(toCentavos(0), 0);
});

test("treats blank as absent, not as zero", () => {
  // A blank debit box and a debit of ₱0.00 are different statements: one says
  // "this side is unused", the other says "this side is zero". The manual
  // entry form needs to tell them apart to know which side a line is on.
  assert.equal(toCentavos(""), null);
  assert.equal(toCentavos("   "), null);
  assert.equal(toCentavos(null), null);
  assert.equal(toCentavos(undefined), null);
});

test("rejects text that is not a number", () => {
  assert.equal(toCentavos("abc"), null);
  assert.equal(toCentavos("1.2.3"), null);
  assert.equal(toCentavos("--5"), null);
});

test("rejects a negative amount", () => {
  // Direction is carried by which column the amount sits in, never by its
  // sign. A negative debit is really a credit, and allowing both spellings
  // means two entries that look different post identically.
  assert.equal(toCentavos("-100"), null);
});

test("rounds half away from zero at the centavo", () => {
  assert.equal(toCentavos("0.005"), 1);
  assert.equal(toCentavos("0.004"), 0);
  assert.equal(toCentavos("1.555"), 156);
});

test("survives the float that breaks naive peso arithmetic", () => {
  // 0.1 + 0.2 === 0.30000000000000004 in pesos. In centavos it is just 30.
  const a = toCentavos("0.10");
  const b = toCentavos("0.20");
  assert.equal(sumCentavos([a, b]), 30);
  assert.equal(sumCentavos([a, b]), toCentavos("0.30"));
});

test("a thousand small amounts still sum exactly", () => {
  const cents = Array.from({ length: 1000 }, () => toCentavos("0.01") ?? 0);
  assert.equal(sumCentavos(cents), 1000);
  assert.equal(fromCentavos(sumCentavos(cents)), 10);
});

test("converts back to pesos for display", () => {
  assert.equal(fromCentavos(150050), 1500.5);
  assert.equal(fromCentavos(0), 0);
  assert.equal(fromCentavos(1), 0.01);
});

test("formats as pesos with two decimals", () => {
  assert.equal(formatCentavos(150050), "₱1,500.50");
  assert.equal(formatCentavos(0), "₱0.00");
  assert.equal(formatCentavos(-150050), "-₱1,500.50");
});

test("sum ignores absent values", () => {
  assert.equal(sumCentavos([100, null, 200, undefined]), 300);
  assert.equal(sumCentavos([]), 0);
});

test("balance check is exact", () => {
  assert.equal(isBalanced(150050, 150050), true);
  assert.equal(isBalanced(150050, 150049), false);
  assert.equal(isBalanced(0, 0), true);
});
