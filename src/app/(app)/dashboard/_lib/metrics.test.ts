import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATA_UNAVAILABLE,
  changeTone,
  compactPeso,
  formatMetric,
  toNumber,
} from "./metrics";

test("server figures parse, and a missing one is null, never zero", () => {
  assert.equal(toNumber("1234.50"), 1234.5);
  assert.equal(toNumber(0), 0);
  assert.equal(toNumber("0.00"), 0);
  assert.equal(toNumber(null), null);
  assert.equal(toNumber(undefined), null);
  assert.equal(toNumber(""), null);
  assert.equal(toNumber("n/a"), null);
});

test("a rise is bad news for a metric where lower is better", () => {
  assert.equal(changeTone(5), "good");
  assert.equal(changeTone(-5), "bad");
  assert.equal(changeTone(5, true), "bad");
  assert.equal(changeTone(-5, true), "good");
  assert.equal(changeTone(0.01), "flat");
  assert.equal(changeTone(null), "flat");
});

test("values format by kind, and a missing value says so", () => {
  assert.equal(formatMetric(null, "currency"), DATA_UNAVAILABLE);
  assert.equal(formatMetric(1234.5, "currency"), "₱1,234.50");
  assert.equal(formatMetric(1_250_000, "currency", true), "₱1.3M");
  assert.equal(formatMetric(950, "currency", true), "₱950.00");
  assert.equal(formatMetric(1520, "count"), "1,520");
  assert.equal(formatMetric(4.256, "percent"), "4.26%");
  assert.equal(compactPeso(-130_000), "-₱130K");
});

