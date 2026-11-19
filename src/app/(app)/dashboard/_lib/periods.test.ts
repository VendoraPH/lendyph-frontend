import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { isValidPeriod, periodDays, presetPeriod, previousPeriod } from "./periods";

// Wednesday 2026-11-18, 07:30 local: before 08:00, where toISOString() would say the 17th.
const NOW = new Date(2026, 10, 18, 7, 30);
const FALLBACK = { from: "2026-01-01", to: "2026-01-31" };

test("today and yesterday use the local calendar day", () => {
  assert.deepEqual(presetPeriod("today", FALLBACK, NOW), { from: "2026-11-18", to: "2026-11-18" });
  assert.deepEqual(presetPeriod("yesterday", FALLBACK, NOW), { from: "2026-11-17", to: "2026-11-17" });
});

test("weeks start on Monday and this week runs to today", () => {
  assert.deepEqual(presetPeriod("this_week", FALLBACK, NOW), { from: "2026-11-16", to: "2026-11-18" });
  assert.deepEqual(presetPeriod("last_week", FALLBACK, NOW), { from: "2026-11-09", to: "2026-11-15" });
  // On a Sunday the week is still the one that started six days earlier.
  const sunday = new Date(2026, 10, 22);
  assert.deepEqual(presetPeriod("this_week", FALLBACK, sunday), { from: "2026-11-16", to: "2026-11-22" });
});

test("month, quarter and year presets", () => {
  assert.deepEqual(presetPeriod("this_month", FALLBACK, NOW), { from: "2026-11-01", to: "2026-11-18" });
  assert.deepEqual(presetPeriod("last_month", FALLBACK, NOW), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(presetPeriod("this_quarter", FALLBACK, NOW), { from: "2026-10-01", to: "2026-11-18" });
  assert.deepEqual(presetPeriod("last_quarter", FALLBACK, NOW), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(presetPeriod("this_year", FALLBACK, NOW), { from: "2026-01-01", to: "2026-11-18" });
  assert.deepEqual(presetPeriod("last_year", FALLBACK, NOW), { from: "2025-01-01", to: "2025-12-31" });
});

test("last quarter in the first quarter is the previous year's fourth", () => {
  assert.deepEqual(presetPeriod("last_quarter", FALLBACK, new Date(2026, 1, 10)), { from: "2025-10-01", to: "2025-12-31" });
});

test("custom keeps the range it was given", () => {
  assert.deepEqual(presetPeriod("custom", FALLBACK, NOW), FALLBACK);
});

test("period length is inclusive, and zero when reversed or unreadable", () => {
  assert.equal(periodDays({ from: "2026-11-18", to: "2026-11-18" }), 1);
  assert.equal(periodDays({ from: "2026-11-01", to: "2026-11-30" }), 30);
  assert.equal(periodDays({ from: "2026-11-30", to: "2026-11-01" }), 0);
  assert.equal(periodDays({ from: "", to: "2026-11-01" }), 0);
  assert.equal(isValidPeriod({ from: "2026-11-30", to: "2026-11-01" }), false);
});

test("the previous period is the same length, ending the day before", () => {
  assert.deepEqual(previousPeriod({ from: "2026-11-18", to: "2026-11-18" }), { from: "2026-11-17", to: "2026-11-17" });
  assert.deepEqual(previousPeriod({ from: "2026-11-01", to: "2026-11-18" }), { from: "2026-10-14", to: "2026-10-31" });
  assert.deepEqual(previousPeriod({ from: "2026-01-01", to: "2026-12-31" }), { from: "2025-01-01", to: "2025-12-31" });
});

test("a whole month compares with the whole month before it", () => {
  assert.deepEqual(previousPeriod({ from: "2026-03-01", to: "2026-03-31" }), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(previousPeriod({ from: "2026-01-01", to: "2026-01-31" }), { from: "2025-12-01", to: "2025-12-31" });
});

test("no comparison for an invalid period", () => {
  assert.equal(previousPeriod({ from: "2026-11-30", to: "2026-11-01" }), null);
});

test("with no date given, presets count from today in Manila, whatever the computer's zone", () => {
  const zone = process.env.TZ;
  // 12:00 UTC on 2026-11-19: 20:00 the 19th in Manila, already 02:00 the 20th in Kiritimati (UTC+14).
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 10, 19, 12, 0) });
  process.env.TZ = "Pacific/Kiritimati";
  try {
    assert.deepEqual(presetPeriod("today", FALLBACK), { from: "2026-11-19", to: "2026-11-19" });
    assert.deepEqual(presetPeriod("this_month", FALLBACK), { from: "2026-11-01", to: "2026-11-19" });
  } finally {
    mock.timers.reset();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});
