import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleDateOptions, latestCycle } from "./cycle-dates";

test("cycles are the 15ths and month ends from today back 92 days, newest first", () => {
  assert.deepEqual(
    cycleDateOptions("2026-11-12").map((c) => `${c.value} ${c.slot}`),
    ["2026-10-31 30", "2026-10-15 15", "2026-09-30 30", "2026-09-15 15", "2026-08-31 30", "2026-08-15 15"],
  );
});

test("today itself is a cycle when it is a 15th or a month end", () => {
  assert.equal(latestCycle("2026-11-15"), "2026-11-15");
  assert.equal(latestCycle("2026-11-30"), "2026-11-30");
  assert.equal(latestCycle("2026-11-14"), "2026-10-31");
});

test("February's cycle is its last day, and leap years are kept", () => {
  assert.ok(cycleDateOptions("2026-03-10").some((c) => c.value === "2026-02-28" && c.slot === "30"));
  assert.ok(cycleDateOptions("2028-03-10").some((c) => c.value === "2028-02-29" && c.slot === "30"));
});

test("a January today reaches back into the previous year, never past 92 days", () => {
  const values = cycleDateOptions("2027-01-05").map((c) => c.value);
  assert.equal(values[0], "2026-12-31");
  assert.ok(values.includes("2026-10-15"));
  assert.ok(!values.includes("2026-09-30"));
});
