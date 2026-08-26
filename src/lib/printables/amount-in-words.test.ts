import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords } from "./amount-in-words";

/**
 * The words are what a court reads if the numerals on a note are altered, so
 * every tier is pinned here rather than spot-checked.
 */

test("nothing to spell reads as zero, never as a blank or NaN", () => {
  assert.equal(amountInWords(0), "Zero Pesos");
  assert.equal(amountInWords(-500), "Zero Pesos");
  assert.equal(amountInWords(Number.NaN), "Zero Pesos");
  assert.equal(amountInWords(Number.POSITIVE_INFINITY), "Zero Pesos");
});

test("units and teens", () => {
  assert.equal(amountInWords(1), "One Pesos");
  assert.equal(amountInWords(9), "Nine Pesos");
  assert.equal(amountInWords(13), "Thirteen Pesos");
  assert.equal(amountInWords(19), "Nineteen Pesos");
});

test("tens compound without a hyphen", () => {
  assert.equal(amountInWords(20), "Twenty Pesos");
  assert.equal(amountInWords(42), "Forty Two Pesos");
  assert.equal(amountInWords(99), "Ninety Nine Pesos");
});

test("hundreds", () => {
  assert.equal(amountInWords(300), "Three Hundred Pesos");
  assert.equal(amountInWords(305), "Three Hundred Five Pesos");
  assert.equal(amountInWords(999), "Nine Hundred Ninety Nine Pesos");
});

test("thousands", () => {
  assert.equal(amountInWords(1000), "One Thousand Pesos");
  assert.equal(
    amountInWords(12345),
    "Twelve Thousand Three Hundred Forty Five Pesos"
  );
  assert.equal(
    amountInWords(750000),
    "Seven Hundred Fifty Thousand Pesos"
  );
});

test("millions", () => {
  assert.equal(amountInWords(1_000_000), "One Million Pesos");
  assert.equal(
    amountInWords(2_500_000),
    "Two Million Five Hundred Thousand Pesos"
  );
});

test("centavos are spelled after the pesos", () => {
  assert.equal(
    amountInWords(1234.5),
    "One Thousand Two Hundred Thirty Four Pesos and Fifty Centavos"
  );
  assert.equal(amountInWords(15.01), "Fifteen Pesos and One Centavos");
});

test("a sub-peso amount still names its pesos", () => {
  // The extracted original produced " Pesos and Seventy Five Centavos" here,
  // with a leading space and no pesos word — unreachable from a promissory
  // note, reachable from a receipt.
  assert.equal(amountInWords(0.75), "Zero Pesos and Seventy Five Centavos");
});

test("centavos that round to a full peso carry instead of reading 'One Hundred Centavos'", () => {
  assert.equal(amountInWords(1.999), "Two Pesos");
  assert.equal(amountInWords(0.999), "One Pesos");
});

test("float drift does not lose a centavo", () => {
  // (1234.56 - 1234) * 100 is 56.00000000000023 in IEEE 754.
  assert.equal(
    amountInWords(1234.56),
    "One Thousand Two Hundred Thirty Four Pesos and Fifty Six Centavos"
  );
  assert.equal(amountInWords(2.29), "Two Pesos and Twenty Nine Centavos");
});
