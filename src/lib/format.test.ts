// Every assertion below is about the gap between a calendar date and a UTC
// instant, so the zone cannot be left to whoever runs the suite. Pin it here.
//
// How: assigning `process.env.TZ` makes Node re-read the zone (it notifies V8,
// which drops its cached offset), and `node:test` runs each test file in its
// own process, so this cannot leak into a sibling suite. The first test asserts
// the pin actually took — without that guard this file would quietly pass on a
// UTC CI box while testing nothing. It is deliberately not left to the machine:
// this repo's dev boxes are already Asia/Manila, which is exactly how the bug
// survived review the first time.
process.env.TZ = "Asia/Manila";

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatDateFull,
  formatDateISO,
  formatDateLong,
  formatTime,
  todayISO,
} from "./format";

/** 00:30 on 7 Aug 2026 in Manila — 16:30 on the 6th in UTC. */
const AT_0030_MANILA = Date.UTC(2026, 7, 6, 16, 30);
/** 07:30 on 7 Aug 2026 in Manila — 23:30 on the 6th in UTC. */
const AT_0730_MANILA = Date.UTC(2026, 7, 6, 23, 30);
/** 08:00 on 7 Aug 2026 in Manila — the moment UTC catches up. */
const AT_0800_MANILA = Date.UTC(2026, 7, 7, 0, 0);

test("the suite is pinned to Manila (UTC+8), not the machine's zone", () => {
  assert.equal(
    new Date(AT_0030_MANILA).getTimezoneOffset(),
    -480,
    "TZ pin did not take effect — every assertion below would be vacuous"
  );
});

// ── formatDateISO ──────────────────────────────────────────────────────────

test("formatDateISO keeps the calendar day at 00:30 Manila", () => {
  assert.equal(formatDateISO(new Date(AT_0030_MANILA)), "2026-08-07");
});

test("formatDateISO keeps the calendar day at 07:30 Manila", () => {
  assert.equal(formatDateISO(new Date(AT_0730_MANILA)), "2026-08-07");
});

test("formatDateISO agrees with UTC once the clock passes 08:00 Manila", () => {
  assert.equal(formatDateISO(new Date(AT_0800_MANILA)), "2026-08-07");
});

// The whole reason formatDateISO exists. If this ever stops holding, the
// boundary cases above are no longer testing anything. The banned expression is
// reproduced verbatim, so these two lines are the rule's own smoke test.
test("toISOString reports the PREVIOUS day for the same instants", () => {
  // eslint-disable-next-line no-restricted-syntax -- documents the old bug
  const at0030 = new Date(AT_0030_MANILA).toISOString().slice(0, 10);
  // eslint-disable-next-line no-restricted-syntax -- documents the old bug
  const at0730 = new Date(AT_0730_MANILA).toISOString().slice(0, 10);

  assert.equal(at0030, "2026-08-06");
  assert.equal(at0730, "2026-08-06");
});

test("formatDateISO zero-pads single-digit months and days", () => {
  assert.equal(formatDateISO(new Date(2026, 0, 5, 0, 30)), "2026-01-05");
});

// A Date built at local midnight is the shape react-day-picker and every
// `new Date(y, m, d)` range helper hand back. toISOString() rolled these back a
// day at *every* hour, not just before 08:00.
test("formatDateISO round-trips a Date built at local midnight", () => {
  assert.equal(formatDateISO(new Date(2026, 7, 1)), "2026-08-01");
  assert.equal(formatDateISO(new Date(2026, 7, 31)), "2026-08-31");
});

// ── todayISO ───────────────────────────────────────────────────────────────

function atManila(instant: number, run: () => void): void {
  mock.timers.enable({ apis: ["Date"], now: instant });
  try {
    run();
  } finally {
    mock.timers.reset();
  }
}

test("todayISO returns today at 00:30 Manila, not yesterday", () => {
  atManila(AT_0030_MANILA, () => {
    assert.equal(todayISO(), "2026-08-07");
  });
});

test("todayISO returns today at 07:59:59 Manila, the last unsafe second", () => {
  atManila(Date.UTC(2026, 7, 6, 23, 59, 59), () => {
    assert.equal(todayISO(), "2026-08-07");
  });
});

/**
 * The bug that started this, in the terms it was reported in: a cashier takes a
 * payment at 07:30 and `payment_date` lands on yesterday's ledger.
 *
 * `todayISO()` is the extracted logic behind payments/page.tsx — it seeds the
 * payment-date field, resets it on loan select and on form reset, and dates the
 * dues preview. The old expression is reproduced verbatim to show the contrast;
 * it is the exact text the new lint rule bans, hence the disable.
 */
test("a payment taken at 07:30 Manila posts today, not yesterday", () => {
  atManila(AT_0730_MANILA, () => {
    // eslint-disable-next-line no-restricted-syntax -- documents the old bug
    const before = new Date().toISOString().split("T")[0];
    const after = todayISO();

    assert.equal(before, "2026-08-06", "the shipped bug: yesterday's date");
    assert.equal(after, "2026-08-07", "the fix: the cashier's actual day");
    assert.notEqual(before, after);
  });
});

test("outside the 00:00-07:59 window the old code was already right", () => {
  atManila(Date.UTC(2026, 7, 7, 6, 0) /* 14:00 Manila */, () => {
    // eslint-disable-next-line no-restricted-syntax -- documents the old bug
    const before = new Date().toISOString().split("T")[0];
    assert.equal(before, todayISO());
    assert.equal(todayISO(), "2026-08-07");
  });
});

// ── formatDateLong / formatDateFull / formatTime ───────────────────────────
//
// These belong in THIS file, not a new one, because they need the same Manila
// pin: a weekday name and a wall-clock time are both properties of the zone.
// On a UTC runner "Friday, August 28" is Thursday evening and "1:30 PM" is
// 5:30 AM.

/** 13:30 on Friday 28 Aug 2026 in Manila — 05:30 UTC the same day. */
const FRI_1330_MANILA = Date.UTC(2026, 7, 28, 5, 30);
/** 00:30 on Friday 28 Aug 2026 in Manila — still the 27th in UTC. */
const FRI_0030_MANILA = Date.UTC(2026, 7, 27, 16, 30);

test("formatDateLong spells the month out", () => {
  assert.equal(formatDateLong(new Date(FRI_1330_MANILA)), "August 28, 2026");
});

test("formatDateLong accepts an ISO string as well as a Date", () => {
  // The whole reason it takes `string | Date`: the split signature on
  // formatDate/formatDateObj is what produced the duplicate copies.
  assert.equal(
    formatDateLong(new Date(FRI_1330_MANILA).toISOString()),
    formatDateLong(new Date(FRI_1330_MANILA))
  );
});

test("formatDateLong keeps the calendar day before 08:00 Manila", () => {
  // The same boundary formatDateISO exists for: 00:30 Manila is still the 27th
  // in UTC, and the reader must still see the 28th.
  assert.equal(formatDateLong(new Date(FRI_0030_MANILA)), "August 28, 2026");
});

test("formatDateFull leads with the weekday", () => {
  assert.equal(
    formatDateFull(new Date(FRI_1330_MANILA)),
    "Friday, August 28, 2026"
  );
});

test("formatDateFull reports the weekday of the LOCAL day, not the UTC one", () => {
  // 00:30 Friday in Manila is 16:30 Thursday in UTC. A dashboard header saying
  // "Thursday" over Friday's collections is the same bug class as the ledger's.
  assert.equal(
    formatDateFull(new Date(FRI_0030_MANILA)),
    "Friday, August 28, 2026"
  );
});

test("formatTime renders a 12-hour wall clock", () => {
  assert.equal(formatTime(new Date(FRI_1330_MANILA)), "1:30 PM");
});

test("formatTime renders midnight-hour times as AM, not 00", () => {
  assert.equal(formatTime(new Date(FRI_0030_MANILA)), "12:30 AM");
});

test("en-US and en-PH are interchangeable for these patterns", () => {
  // The call sites being consolidated were split between the two locales by
  // habit, not intent. Asserted rather than assumed, because it is the reason
  // moving them to the en-PH helpers is a zero-diff change.
  const d = new Date(FRI_1330_MANILA);
  assert.equal(
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    formatDate(d.toISOString())
  );
  assert.equal(
    d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    formatDateLong(d)
  );
  assert.equal(
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    formatTime(d)
  );
});
