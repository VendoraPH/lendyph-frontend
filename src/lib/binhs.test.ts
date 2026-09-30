// Schedule due dates are calendar dates. Pin the zone for the same reason
// format.test.ts does — see the note there for how and why.
process.env.TZ = "Asia/Manila";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomSchedule,
  buildIdealSchedule,
  buildWorstCaseSchedule,
  type BinhsInput,
} from "./binhs";

const input = (over: Partial<BinhsInput> = {}): BinhsInput => ({
  principal: 10000,
  annualInterestRate: 24,
  termMonths: 3,
  scbuPerPeriod: 100,
  startDate: "2026-08-07",
  ...over,
});

const dueDates = (over: Partial<BinhsInput> = {}) =>
  buildIdealSchedule(input(over)).map((r) => r.dueDate);

test("the first due date is the date the user picked, verbatim", () => {
  assert.equal(dueDates()[0], "2026-08-07");
});

test("due dates advance one calendar month at a time", () => {
  assert.deepEqual(dueDates(), ["2026-08-07", "2026-09-07", "2026-10-07"]);
});

// `new Date("2026-08-31")` is UTC midnight, but the month arithmetic runs on
// local getters — the two only agreed east of UTC. Parsing the parts locally
// makes the clamp behave the same everywhere.
test("a 31st start clamps to the last day of a shorter month", () => {
  assert.deepEqual(
    dueDates({ startDate: "2026-08-31", termMonths: 3 }),
    ["2026-08-31", "2026-09-30", "2026-10-31"]
  );
});

test("a leap-day-adjacent start rolls through February correctly", () => {
  assert.deepEqual(
    dueDates({ startDate: "2027-01-31", termMonths: 3 }),
    ["2027-01-31", "2027-02-28", "2027-03-31"]
  );
});

test("in a leap year a 31st start falls due on Feb 29, then the 31st again", () => {
  assert.deepEqual(
    dueDates({ startDate: "2028-01-31", termMonths: 4 }),
    ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]
  );
});

test("a 30th start caps only in February and returns to the 30th after it", () => {
  assert.deepEqual(
    dueDates({ startDate: "2026-09-30", termMonths: 7 }),
    ["2026-09-30", "2026-10-30", "2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"]
  );
});

test("a 29th start caps to Feb 28 in a common year only", () => {
  assert.deepEqual(dueDates({ startDate: "2027-01-29", termMonths: 3 }), ["2027-01-29", "2027-02-28", "2027-03-29"]);
  assert.deepEqual(dueDates({ startDate: "2028-01-29", termMonths: 3 }), ["2028-01-29", "2028-02-29", "2028-03-29"]);
});

test("every BINHS schedule dates its rows the same way", () => {
  const over = { startDate: "2027-01-31", termMonths: 4 };
  const expected = ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"];
  assert.deepEqual(buildWorstCaseSchedule(input(over)).map((r) => r.dueDate), expected);
  assert.deepEqual(buildCustomSchedule(input(over), [true, false, true, false]).map((r) => r.dueDate), expected);
});

test("a start date carrying a time component still yields its calendar day", () => {
  // loan.start_date can arrive from the API as "YYYY-MM-DD HH:mm:ss".
  assert.equal(dueDates({ startDate: "2026-08-07 00:00:00" })[0], "2026-08-07");
});

test("an unparseable start date is handed back untouched", () => {
  assert.deepEqual(dueDates({ startDate: "not-a-date" }), []);
});
