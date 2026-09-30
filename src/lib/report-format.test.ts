import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatRatePercent, formatValue, rateOrDash } from "./report-format";

test("rate: a stored rate prints with every place it has", () => {
  assert.equal(formatValue(2.5, "rate"), "2.5%");
  assert.equal(formatValue(1.75, "rate"), "1.75%");
  assert.equal(formatValue(1.125, "rate"), "1.125%");
  assert.equal(formatValue(1.1234, "rate"), "1.1234%");
});

test("rate: the API's padded decimal strings print without the padding", () => {
  assert.equal(formatValue("1.5000", "rate"), "1.5%");
  assert.equal(formatValue("1.1250", "rate"), "1.125%");
});

test("rate: whole numbers print as they always have", () => {
  assert.equal(formatValue(3, "rate"), "3.0%");
  assert.equal(formatValue("3.0000", "rate"), "3.0%");
  assert.equal(formatRatePercent(5), "5.0%");
});

test("percent: a computed ratio still prints to one decimal", () => {
  // The two formats differ on purpose: a share of the book is a statistic.
  assert.equal(formatValue(33.3333, "percent"), "33.3%");
  assert.equal(formatValue(1.125, "rate"), "1.125%");
  assert.equal(formatValue(1.125, "percent"), "1.1%");
});

test("rateOrDash: a rate when there is one, a dash when there is not", () => {
  assert.equal(rateOrDash(2.02), "2.02%");
  assert.equal(rateOrDash("1.2500"), "1.25%");
  assert.equal(rateOrDash(null), DASH);
  assert.equal(rateOrDash("n/a"), DASH);
});
