import { test } from "node:test";
import assert from "node:assert/strict";
import { checkScheduleIntegrity } from "./amortization";

// The loan that surfaced this: LA-000002, PHP 5,000 @ 5%/month for 4 months,
// monthly, straight. The API persisted a single row carrying one month of
// interest (PHP 250) instead of four rows totalling PHP 1,000.
const LA000002 = {
  principal: 5000,
  monthlyRate: 5,
  termMonths: 4,
  frequency: "monthly",
  interestMethod: "straight",
};

test("flags a monthly loan whose API schedule collapsed to a single period", () => {
  const result = checkScheduleIntegrity({
    ...LA000002,
    actualPeriods: 1,
    actualInterest: 250,
  });

  assert.ok(result);
  assert.equal(result.periodsMismatch, true);
  assert.equal(result.interestMismatch, true);
  assert.equal(result.expectedPeriods, 4);
  assert.equal(result.expectedInterest, 1000);
});

test("passes the same loan when the API returns the four periods it should", () => {
  assert.equal(
    checkScheduleIntegrity({
      ...LA000002,
      actualPeriods: 4,
      actualInterest: 1000,
    }),
    null
  );
});

// Interest is the part that costs money, so a right-shaped schedule carrying
// the wrong total must still be caught.
test("flags the correct period count paired with understated interest", () => {
  const result = checkScheduleIntegrity({
    ...LA000002,
    actualPeriods: 4,
    actualInterest: 250,
  });

  assert.ok(result);
  assert.equal(result.periodsMismatch, false);
  assert.equal(result.interestMismatch, true);
});

test("absorbs sub-peso rounding drift in the interest total", () => {
  assert.equal(
    checkScheduleIntegrity({
      ...LA000002,
      actualPeriods: 4,
      actualInterest: 1000.4,
    }),
    null
  );
});

// Upon Maturity legitimately collapses the term into one payment, but still
// owes interest for every month of it.
test("accepts a one-row upon-maturity schedule carrying full-term interest", () => {
  assert.equal(
    checkScheduleIntegrity({
      ...LA000002,
      frequency: "upon_maturity",
      actualPeriods: 1,
      actualInterest: 1000,
    }),
    null
  );
});

test("flags an upon-maturity schedule charging only one month of interest", () => {
  const result = checkScheduleIntegrity({
    ...LA000002,
    interestMethod: "upon_maturity",
    actualPeriods: 1,
    actualInterest: 250,
  });

  assert.ok(result);
  assert.equal(result.periodsMismatch, false);
  assert.equal(result.interestMismatch, true);
  assert.equal(result.expectedInterest, 1000);
});

test("expects a weekly loan to run 4.33 periods per month of term", () => {
  const result = checkScheduleIntegrity({
    ...LA000002,
    frequency: "weekly",
    actualPeriods: 4,
    actualInterest: 1000,
  });

  assert.ok(result);
  assert.equal(result.expectedPeriods, 17);
});

test("recognises diminishing balance rather than assuming flat interest", () => {
  const flat = checkScheduleIntegrity({
    ...LA000002,
    interestMethod: "diminishing",
    actualPeriods: 4,
    actualInterest: 1000,
  });

  // Diminishing accrues on the falling balance, so PHP 1,000 is too much.
  assert.ok(flat);
  assert.equal(flat.periodsMismatch, false);
  assert.ok(flat.expectedInterest < 1000);
});

// A false alarm on a correct schedule is worse than staying quiet, so anything
// we cannot map is left unchecked.
test("stays silent on a frequency whose period count cannot be derived", () => {
  assert.equal(
    checkScheduleIntegrity({
      ...LA000002,
      frequency: "semi_monthly",
      actualPeriods: 1,
      actualInterest: 250,
    }),
    null
  );
});

test("stays silent when the loan terms are incomplete", () => {
  for (const missing of [
    { principal: 0 },
    { monthlyRate: 0 },
    { termMonths: 0 },
  ]) {
    assert.equal(
      checkScheduleIntegrity({
        ...LA000002,
        ...missing,
        actualPeriods: 1,
        actualInterest: 250,
      }),
      null
    );
  }
});

test("stays silent when no schedule has been returned yet", () => {
  assert.equal(
    checkScheduleIntegrity({
      ...LA000002,
      actualPeriods: 0,
      actualInterest: 0,
    }),
    null
  );
});
