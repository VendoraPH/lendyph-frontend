import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, presetRange } from "./report-period";

// 16 Nov 2026, mid-afternoon on the computer's own clock.
const NOW = new Date(2026, 10, 16, 15, 30);
const FALLBACK = { from: "2026-01-02", to: "2026-01-03" };

test("each preset reads its period from the given today", () => {
  const cases: [Parameters<typeof presetRange>[0], string, string][] = [
    ["today", "2026-11-16", "2026-11-16"],
    ["yesterday", "2026-11-15", "2026-11-15"],
    ["last_7", "2026-11-10", "2026-11-16"],
    ["this_month", "2026-11-01", "2026-11-16"],
    ["whole_month", "2026-11-01", "2026-11-30"],
    ["last_month", "2026-10-01", "2026-10-31"],
    ["ytd", "2026-01-01", "2026-11-16"],
  ];
  for (const [preset, from, to] of cases) {
    assert.deepEqual(presetRange(preset, FALLBACK, NOW), { from, to }, preset);
  }
});

test("a custom period keeps the range it was given", () => {
  assert.deepEqual(presetRange("custom", FALLBACK, NOW), FALLBACK);
});

test("presets cross month and year ends by the calendar", () => {
  const firstOfMarch = new Date(2028, 2, 1, 9);
  assert.deepEqual(presetRange("yesterday", FALLBACK, firstOfMarch), { from: "2028-02-29", to: "2028-02-29" });
  assert.deepEqual(presetRange("last_month", FALLBACK, firstOfMarch), { from: "2028-02-01", to: "2028-02-29" });
  const newYear = new Date(2027, 0, 3, 9);
  assert.deepEqual(presetRange("last_7", FALLBACK, newYear), { from: "2026-12-28", to: "2027-01-03" });
  assert.deepEqual(presetRange("last_month", FALLBACK, newYear), { from: "2026-12-01", to: "2026-12-31" });
});

test("the period buttons keep their order and words", () => {
  assert.deepEqual(
    PRESETS.map((p) => p.label),
    ["Today", "Yesterday", "Last 7 Days", "This Month", "Whole Month", "Last Month", "Year to Date", "Custom"],
  );
});
