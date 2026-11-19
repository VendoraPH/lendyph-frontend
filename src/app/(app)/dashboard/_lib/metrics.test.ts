import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATA_UNAVAILABLE,
  METRICS,
  OVERVIEW_METRICS,
  changeTone,
  compactPeso,
  formatChange,
  formatMetric,
  percentChange,
  pointChange,
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

test("percent change has no value without a base", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(null, 100), null);
  assert.equal(percentChange(100, null), null);
  assert.equal(percentChange(-50, -100), 50);
});

test("a ratio changes in points", () => {
  assert.equal(pointChange(92.5, 90), 2.5);
  assert.equal(pointChange(null, 90), null);
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

test("changes read as percent or points", () => {
  assert.equal(formatChange(4.24, "period"), "+4.2%");
  assert.equal(formatChange(-1.1, "ratio"), "−1.10 pts");
  assert.equal(formatChange(null, "period"), null);
});

test("every overview metric is defined, with a formula, a source and a drilldown", () => {
  assert.equal(OVERVIEW_METRICS.length, 12);
  for (const id of OVERVIEW_METRICS) {
    const m = METRICS[id];
    assert.ok(m.formula.length > 10, `${id} has no formula`);
    assert.ok(m.source.startsWith("GET /"), `${id} has no source`);
    assert.ok(m.href.startsWith("/"), `${id} has no drilldown`);
  }
});
