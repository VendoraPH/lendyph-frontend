import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DATE_RANGE_REVERSED, dateRangeReady, dateRangeReversed, filterDateReady } from "./date-range";

describe("a reversed Date From / Date To", () => {
  test("Date To before Date From is reversed", () => {
    assert.equal(dateRangeReversed("2026-11-30", "2026-11-01"), true);
    assert.equal(DATE_RANGE_REVERSED, "Date To is before Date From.");
  });

  test("the same day, or a range in order, is not", () => {
    assert.equal(dateRangeReversed("2026-11-01", "2026-11-01"), false);
    assert.equal(dateRangeReversed("2026-11-01", "2026-11-30"), false);
  });

  test("an open end is never reversed", () => {
    assert.equal(dateRangeReversed("", "2026-11-01"), false);
    assert.equal(dateRangeReversed("2026-11-30", ""), false);
    assert.equal(dateRangeReversed("", ""), false);
  });
});

describe("a date still being typed", () => {
  test("a year being typed waits: 0002, 0020, 0202", () => {
    for (const partial of ["0002-11-24", "0020-11-24", "0202-11-24"]) {
      assert.equal(filterDateReady(partial), false, partial);
    }
  });

  test("a year before 1900 waits; 1900 and later are ready", () => {
    assert.equal(filterDateReady("1899-12-31"), false);
    assert.equal(filterDateReady("1900-01-01"), true);
    assert.equal(filterDateReady("2026-11-24"), true);
  });

  test("a day that doesn't exist, or a shape that isn't YYYY-MM-DD, waits", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2026-1-5", "20261124", "2026-11-24T00:00", "abc"]) {
      assert.equal(filterDateReady(bad), false, bad);
    }
  });

  test("an empty date is an open end, so it is ready", () => {
    assert.equal(filterDateReady(""), true);
  });

  test("the list asks only when both ends are ready", () => {
    assert.equal(dateRangeReady("", ""), true);
    assert.equal(dateRangeReady("2026-11-01", ""), true);
    assert.equal(dateRangeReady("2026-11-01", "2026-11-30"), true);
    assert.equal(dateRangeReady("2026-11-01", "0202-11-30"), false);
    assert.equal(dateRangeReady("0020-11-01", "2026-11-30"), false);
  });
});

describe("a date input the browser holds as partial", () => {
  test("a native date input reports \"\" while it's partial; its badInput keeps it waiting", () => {
    assert.equal(filterDateReady("", true), false);
    assert.equal(filterDateReady("", false), true);
  });

  test("the range waits while either input is partial", () => {
    assert.equal(dateRangeReady("", "", { from: true }), false);
    assert.equal(dateRangeReady("2026-11-01", "", { to: true }), false);
    assert.equal(dateRangeReady("2026-11-01", "2026-11-30", {}), true);
    assert.equal(dateRangeReady("2026-11-01", "", { from: false, to: false }), true);
  });
});
