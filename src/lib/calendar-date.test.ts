import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDateParts, isCalendarDate } from "./calendar-date";

test("a calendar date is written year-month-day and names a real day", () => {
  assert.deepEqual(calendarDateParts("2026-11-24"), [2026, 11, 24]);
  assert.deepEqual(calendarDateParts("2024-02-29"), [2024, 2, 29]);
  assert.equal(isCalendarDate("2026-11-24"), true);
});

test("anything else is not one", () => {
  for (const value of ["2026-02-29", "2026-13-01", "2026-11-31", "2026/11/24", "20261124", "2026-11-24T00:00", " 2026-11-24", "", null, undefined]) {
    assert.equal(calendarDateParts(value), null, String(value));
    assert.equal(isCalendarDate(value), false, String(value));
  }
});
