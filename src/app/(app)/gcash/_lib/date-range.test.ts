import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DATE_RANGE_REVERSED, dateRangeReversed } from "./date-range";

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
