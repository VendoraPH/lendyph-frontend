import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSURANCE_PCT_DECIMALS,
  decimalInputValue,
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
