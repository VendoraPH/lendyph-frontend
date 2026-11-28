import assert from "node:assert/strict";
import { test } from "node:test";

import { liveReferenceDates } from "./live-dates";

test("a live view offers today and the month ends of the last 92 days", () => {
  assert.deepEqual(liveReferenceDates("2026-11-28"), ["2026-11-28", "2026-10-31", "2026-09-30", "2026-08-31"]);
});

test("a month end exactly 92 days back is still offered, one a day older is not", () => {
  // 2026-10-31 is 92 days after 2026-07-31.
  assert.deepEqual(liveReferenceDates("2026-10-31"), ["2026-10-31", "2026-09-30", "2026-08-31", "2026-07-31"]);
  assert.deepEqual(liveReferenceDates("2026-11-01"), ["2026-11-01", "2026-10-31", "2026-09-30", "2026-08-31"]);
});

test("today is listed once when it is itself a month end", () => {
  const dates = liveReferenceDates("2026-11-30");
  assert.equal(dates.filter((d) => d === "2026-11-30").length, 1);
  assert.equal(dates[0], "2026-11-30");
});

test("month ends cross the year and keep February's last day", () => {
  assert.deepEqual(liveReferenceDates("2028-03-15"), ["2028-03-15", "2028-02-29", "2028-01-31", "2027-12-31"]);
  assert.deepEqual(liveReferenceDates("2027-01-05"), ["2027-01-05", "2026-12-31", "2026-11-30", "2026-10-31"]);
});
