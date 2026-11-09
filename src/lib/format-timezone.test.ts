// Round fz: dates read in Philippine time on any computer. Each test below runs
// the formatters on a computer set west of Manila (New York) and one east of it
// (Auckland), and expects what a Manila computer shows. Assigning
// `process.env.TZ` makes Node re-read the zone, and `node:test` runs each file
// in its own process, so the switch can't leak into another suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatDateFull,
  formatDateLong,
  formatDateObj,
  formatDateTime,
  formatTime,
} from "./format";

const ELSEWHERE = ["America/New_York", "Pacific/Auckland"];

function onEveryComputer(check: () => void) {
  const original = process.env.TZ;
  try {
    for (const zone of [...ELSEWHERE, "Asia/Manila"]) {
      process.env.TZ = zone;
      check();
    }
  } finally {
    process.env.TZ = original;
  }
}

/** 20:00 on 9 Nov 2026 in Manila: 07:00 the 9th in New York, 01:00 the 10th in Auckland. */
const EVENING_MANILA = "2026-11-09T12:00:00Z";
/** 04:00 on 10 Nov 2026 in Manila: 15:00 the 9th in New York. */
const EARLY_MANILA = "2026-11-09T20:00:00.000000Z";

test("the zone switch takes effect, so the checks below aren't vacuous", () => {
  const offsets: number[] = [];
  onEveryComputer(() => offsets.push(new Date(EVENING_MANILA).getTimezoneOffset()));
  assert.deepEqual(offsets, [300, -780, -480]);
});

test("a date-only value shows that same calendar date", () => {
  onEveryComputer(() => {
    assert.equal(formatDate("2026-08-30"), "Aug 30, 2026");
    assert.equal(formatDate("2026-01-01"), "Jan 1, 2026");
    assert.equal(formatDateLong("2026-08-30"), "August 30, 2026");
    assert.equal(formatDateFull("2026-08-30"), "Sunday, August 30, 2026");
  });
});

test("a UTC timestamp shows Manila's date", () => {
  onEveryComputer(() => {
    assert.equal(formatDate(EVENING_MANILA), "Nov 9, 2026");
    assert.equal(formatDate(EARLY_MANILA), "Nov 10, 2026");
    assert.equal(formatDateLong(EARLY_MANILA), "November 10, 2026");
    assert.equal(formatDateFull(new Date(EARLY_MANILA)), "Tuesday, November 10, 2026");
  });
});

test("a UTC timestamp shows Manila's date and time", () => {
  onEveryComputer(() => {
    assert.equal(formatDateTime(EVENING_MANILA), "Nov 9, 2026, 08:00 PM");
    assert.equal(formatDateTime(EARLY_MANILA), "Nov 10, 2026, 04:00 AM");
    assert.equal(formatTime(EVENING_MANILA), "8:00 PM");
    assert.equal(formatTime(new Date(EARLY_MANILA)), "4:00 AM");
  });
});

test("a server time with no zone is Manila time", () => {
  onEveryComputer(() => {
    assert.equal(formatDateTime("2026-11-09 14:05:00"), "Nov 9, 2026, 02:05 PM");
    assert.equal(formatDateTime("2026-11-09T23:30"), "Nov 9, 2026, 11:30 PM");
    assert.equal(formatTime("2026-11-09 00:15:00"), "12:15 AM");
  });
});

test("a picked calendar date (a Date at the computer's own midnight) keeps its day", () => {
  onEveryComputer(() => {
    assert.equal(formatDateObj(new Date(2026, 7, 30)), "Aug 30, 2026");
    assert.equal(formatDateObj(new Date(2026, 0, 1)), "Jan 1, 2026");
  });
});
