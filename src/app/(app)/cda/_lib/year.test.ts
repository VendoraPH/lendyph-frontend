import { test } from "node:test";
import assert from "node:assert/strict";
import { pickYear } from "./year";

const PERIODS = [{ year: 2026 }, { year: 2025 }, { year: 2024 }];

test("a link's ?year= wins over the remembered year when that year is open", () => {
  assert.equal(pickYear("2024", 2026, PERIODS), 2024);
});

test("without ?year= the remembered year opens, else the newest", () => {
  assert.equal(pickYear(null, 2025, PERIODS), 2025);
  assert.equal(pickYear(null, null, PERIODS), 2026);
});

test("a ?year= that isn't an open period, or isn't a year, is ignored", () => {
  assert.equal(pickYear("2019", 2025, PERIODS), 2025);
  assert.equal(pickYear("20x5", 2025, PERIODS), 2025);
  assert.equal(pickYear("", null, PERIODS), 2026);
});

test("no open period means no year, whatever the link says", () => {
  assert.equal(pickYear("2026", 2026, []), null);
});
