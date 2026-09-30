import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSURANCE_PCT_DECIMALS,
  decimalInputValue,
  percentOf,
  roundCentavos,
  sanitizeDecimalInput,
} from "./percent";

// ── sanitizeDecimalInput ───────────────────────────────────────────────────

test("sanitize keeps fractional rates exactly as typed", () => {
  assert.equal(sanitizeDecimalInput("2.5"), "2.5");
  assert.equal(sanitizeDecimalInput("1.75"), "1.75");
  assert.equal(sanitizeDecimalInput("1.1234"), "1.1234");
  assert.equal(parseFloat(sanitizeDecimalInput("1.75")), 1.75);
});

test("sanitize leaves whole numbers alone", () => {
  assert.equal(sanitizeDecimalInput("5"), "5");
  assert.equal(sanitizeDecimalInput("12"), "12");
  assert.equal(sanitizeDecimalInput(""), "");
});

test("sanitize refuses a fifth decimal place instead of rounding it", () => {
  // 1.23456 rounded would be 1.2346; the field keeps what the column can hold.
  assert.equal(sanitizeDecimalInput("1.23456"), "1.2345");
  assert.equal(sanitizeDecimalInput("1.99999"), "1.9999");
});

test("sanitize allows two places for the insurance premium", () => {
  assert.equal(sanitizeDecimalInput("1.255", INSURANCE_PCT_DECIMALS), "1.25");
  assert.equal(sanitizeDecimalInput("2.5", INSURANCE_PCT_DECIMALS), "2.5");
});

test("sanitize keeps a trailing point so the next digit can follow", () => {
  assert.equal(sanitizeDecimalInput("1."), "1.");
  assert.equal(sanitizeDecimalInput(".5"), ".5");
});

test("sanitize drops anything that is not a digit or the first point", () => {
  assert.equal(sanitizeDecimalInput("1.5%"), "1.5");
  assert.equal(sanitizeDecimalInput("-2.5"), "2.5");
  assert.equal(sanitizeDecimalInput("1,5"), "15");
  assert.equal(sanitizeDecimalInput("1.2.3"), "1.23");
  assert.equal(sanitizeDecimalInput("abc"), "");
});

// ── decimalInputValue ──────────────────────────────────────────────────────

test("prefill drops the API's decimal padding without rounding", () => {
  assert.equal(decimalInputValue("1.5000"), "1.5");
  assert.equal(decimalInputValue("2.5000"), "2.5");
  assert.equal(decimalInputValue("1.7500"), "1.75");
  assert.equal(decimalInputValue("1.1234"), "1.1234");
  assert.equal(decimalInputValue(1.75), "1.75");
});

test("prefill shows whole numbers as whole numbers", () => {
  assert.equal(decimalInputValue("5.0000"), "5");
  assert.equal(decimalInputValue(5), "5");
  assert.equal(decimalInputValue("0.0000"), "0");
});

test("prefill is blank when there is no rate to show", () => {
  assert.equal(decimalInputValue(null), "");
  assert.equal(decimalInputValue(undefined), "");
  assert.equal(decimalInputValue(""), "");
  assert.equal(decimalInputValue("n/a"), "");
});

// ── roundCentavos ──────────────────────────────────────────────────────────

test("centavos round half away from zero, as PHP round() does", () => {
  // 150.015 is 150.01499999… in binary; Math.round(x * 100) / 100 gives 150.01.
  assert.equal(roundCentavos(150.015), 150.02);
  assert.equal(roundCentavos(1.005), 1.01);
  assert.equal(roundCentavos(-1.005), -1.01);
  assert.equal(roundCentavos(216.0375), 216.04);
});

test("centavos round down where PHP 8.4 does, below a halfway point that is not exact", () => {
  // 303,071.60 × 11.25% is 34095.554999999993 in binary. PHP 8.4 books
  // 34,095.55 (checked against php 8.4.1); settling to 15 digits first gives .56.
  assert.equal(roundCentavos((303071.6 * 11.25) / 100), 34095.55);
  assert.equal(percentOf(303071.6, 11.25), 34095.55);
});

test("centavos leave exact amounts untouched", () => {
  assert.equal(roundCentavos(250), 250);
  assert.equal(roundCentavos(150.02), 150.02);
  assert.equal(roundCentavos(0), 0);
});

// ── percentOf ──────────────────────────────────────────────────────────────

test("a fractional fee is charged at its exact rate", () => {
  assert.equal(percentOf(10000, 2.5), 250);
  assert.equal(percentOf(10000, 1.75), 175);
  assert.equal(percentOf(10000, 1.5), 150);
  // Not 200: the rate a 1.5% product used to be rounded up to.
  assert.notEqual(percentOf(10000, 1.5), percentOf(10000, 2));
});

test("a fee lands on the centavo the API books", () => {
  // round(10001 * 1.5 / 100, 2) and round(12345 * 1.75 / 100, 2) in PHP.
  assert.equal(percentOf(10001, 1.5), 150.02);
  assert.equal(percentOf(12345, 1.75), 216.04);
  assert.equal(percentOf(12345, 1.1234), 138.68);
});

test("whole-number fees are unchanged", () => {
  assert.equal(percentOf(10000, 5), 500);
  assert.equal(percentOf(25000, 3), 750);
  assert.equal(percentOf(10000, 0), 0);
});
