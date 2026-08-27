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
import { formatDateISO, todayISO } from "./format";

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
