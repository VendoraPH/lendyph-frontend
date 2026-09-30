/**
 * The Extend dialog's "New Maturity Date", pinned against the server's step.
 *
 * The dialog added a month to `loans.maturity_date` in the browser's time
 * zone. The server steps from the latest open instalment instead
 * (`LoanAdjustmentService::extendLoan()`), and `new Date("YYYY-MM-DD")` is
 * UTC midnight, which is the previous day anywhere west of UTC.
 *
 * WHAT THIS PROVES: the date shown is one period, by frequency, after the
 * latest open instalment, with Carbon's month overflow at month end.
 * WHAT IT DOES NOT PROVE: the server's own behaviour, which this mirrors from
 * `stepNextPeriod()` and Carbon 3's overflowing `addMonth()`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extensionDueDate, stepNextPeriod } from "./extension-due-date";

describe("stepNextPeriod", () => {
  test("a month is the same day next month", () => {
    assert.equal(stepNextPeriod("2026-10-15", "monthly"), "2026-11-15");
    assert.equal(stepNextPeriod("2026-10-15", "upon_maturity"), "2026-11-15");
  });

  test("from Jan 31 a month overflows into March, as Carbon's addMonth() does", () => {
    assert.equal(stepNextPeriod("2026-01-31", "monthly"), "2026-03-03");
    assert.equal(stepNextPeriod("2026-01-29", "monthly"), "2026-03-01");
    assert.equal(stepNextPeriod("2026-01-28", "monthly"), "2026-02-28");
  });

  test("in a leap year it overflows one day less", () => {
    assert.equal(stepNextPeriod("2028-01-31", "monthly"), "2028-03-02");
    assert.equal(stepNextPeriod("2028-01-29", "monthly"), "2028-02-29");
  });

  test("a 31st before a 30-day month lands on the 1st after it", () => {
    assert.equal(stepNextPeriod("2026-03-31", "monthly"), "2026-05-01");
    assert.equal(stepNextPeriod("2026-08-31", "monthly"), "2026-10-01");
  });

  test("December rolls into the next year", () => {
    assert.equal(stepNextPeriod("2026-12-31", "monthly"), "2027-01-31");
  });

  test("the day-stepped frequencies add their fixed days", () => {
    assert.equal(stepNextPeriod("2026-02-20", "daily"), "2026-02-21");
    assert.equal(stepNextPeriod("2026-02-20", "weekly"), "2026-02-27");
    assert.equal(stepNextPeriod("2026-02-20", "bi_weekly"), "2026-03-06");
    assert.equal(stepNextPeriod("2026-02-20", "semi_monthly"), "2026-03-07");
  });

  test("a frequency the server has no step for, or an unreadable date, gives nothing", () => {
    assert.equal(stepNextPeriod("2026-02-20", "yearly"), null);
    assert.equal(stepNextPeriod("", "monthly"), null);
  });
});

describe("extensionDueDate", () => {
  test("steps from the latest open instalment, not from a paid one", () => {
    const rows = [
      { due_date: "2026-01-31", status: "paid" as const },
      { due_date: "2026-03-03", status: "partial" as const },
      { due_date: "2026-02-15", status: "overdue" as const },
      { due_date: "2026-04-30", status: "paid" as const },
    ];

    assert.equal(extensionDueDate(rows, "monthly"), "2026-04-03");
  });

  test("a month-end open instalment overflows like the server's", () => {
    assert.equal(extensionDueDate([{ due_date: "2026-01-31", status: "pending" }], "monthly"), "2026-03-03");
  });

  test("nothing open, nothing to extend", () => {
    assert.equal(extensionDueDate([{ due_date: "2026-01-31", status: "paid" }], "monthly"), null);
    assert.equal(extensionDueDate([], "monthly"), null);
  });
});
