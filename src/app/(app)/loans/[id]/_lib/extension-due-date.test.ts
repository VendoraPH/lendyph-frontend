/**
 * The Extend dialog's "New Maturity Date", pinned against the server's step.
 *
 * The dialog added a month to `loans.maturity_date` in the browser's time
 * zone. The server steps from the latest open instalment instead
 * (`LoanAdjustmentService::extendLoan()`), and `new Date("YYYY-MM-DD")` is
 * UTC midnight, which is the previous day anywhere west of UTC.
 *
 * WHAT THIS PROVES: the date shown is one period, by frequency, after the
 * latest open instalment. A month lands on the loan's start day, capped to
 * the last day of a shorter month.
 * WHAT IT DOES NOT PROVE: the server's own behaviour, which this mirrors from
 * `stepNextPeriod()`'s anchored month step.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extensionDueDate, stepNextPeriod } from "./extension-due-date";

describe("stepNextPeriod", () => {
  test("a month is the anchor day of the next month", () => {
    assert.equal(stepNextPeriod("2026-10-15", "monthly", 15), "2026-11-15");
    assert.equal(stepNextPeriod("2026-10-15", "upon_maturity", 15), "2026-11-15");
  });

  test("a 31st anchor caps to a short month's last day, and returns to the 31st after it", () => {
    assert.equal(stepNextPeriod("2027-01-31", "monthly", 31), "2027-02-28");
    assert.equal(stepNextPeriod("2027-02-28", "monthly", 31), "2027-03-31");
    assert.equal(stepNextPeriod("2027-03-31", "monthly", 31), "2027-04-30");
    assert.equal(stepNextPeriod("2027-04-30", "monthly", 31), "2027-05-31");
  });

  test("in a leap year February keeps its 29th", () => {
    assert.equal(stepNextPeriod("2028-01-31", "monthly", 31), "2028-02-29");
    assert.equal(stepNextPeriod("2028-01-29", "monthly", 29), "2028-02-29");
    assert.equal(stepNextPeriod("2028-02-29", "monthly", 31), "2028-03-31");
  });

  test("a 29th or 30th anchor caps only in February", () => {
    assert.equal(stepNextPeriod("2027-01-29", "monthly", 29), "2027-02-28");
    assert.equal(stepNextPeriod("2027-02-28", "monthly", 29), "2027-03-29");
    assert.equal(stepNextPeriod("2027-01-30", "monthly", 30), "2027-02-28");
    assert.equal(stepNextPeriod("2027-02-28", "monthly", 30), "2027-03-30");
  });

  test("a 28th anchor never caps", () => {
    assert.equal(stepNextPeriod("2027-01-28", "monthly", 28), "2027-02-28");
    assert.equal(stepNextPeriod("2027-02-28", "monthly", 28), "2027-03-28");
  });

  test("December rolls into the next year", () => {
    assert.equal(stepNextPeriod("2026-12-31", "monthly", 31), "2027-01-31");
  });

  test("the day-stepped frequencies add their fixed days, whatever the anchor", () => {
    for (const anchorDay of [20, 31]) {
      assert.equal(stepNextPeriod("2026-02-20", "daily", anchorDay), "2026-02-21");
      assert.equal(stepNextPeriod("2026-02-20", "weekly", anchorDay), "2026-02-27");
      assert.equal(stepNextPeriod("2026-02-20", "bi_weekly", anchorDay), "2026-03-06");
      assert.equal(stepNextPeriod("2026-02-20", "semi_monthly", anchorDay), "2026-03-07");
    }
    assert.equal(stepNextPeriod("2027-01-31", "weekly", 31), "2027-02-07");
  });

  test("a frequency the server has no step for, or an unreadable date, gives nothing", () => {
    assert.equal(stepNextPeriod("2026-02-20", "yearly", 20), null);
    assert.equal(stepNextPeriod("", "monthly", 20), null);
  });
});

describe("extensionDueDate", () => {
  test("steps from the latest open instalment, not from a paid one", () => {
    const rows = [
      { due_date: "2026-01-15", status: "paid" as const },
      { due_date: "2026-03-15", status: "partial" as const },
      { due_date: "2026-02-15", status: "overdue" as const },
      { due_date: "2026-04-30", status: "paid" as const },
    ];

    assert.equal(extensionDueDate(rows, "monthly", "2025-12-15"), "2026-04-15");
  });

  test("a Jan 31 loan's open Feb 28 instalment extends to Mar 31, then Apr 30", () => {
    const start = "2027-01-31";
    assert.equal(extensionDueDate([{ due_date: "2027-02-28", status: "pending" }], "monthly", start), "2027-03-31");
    assert.equal(
      extensionDueDate(
        [
          { due_date: "2027-02-28", status: "paid" },
          { due_date: "2027-03-31", status: "overdue" },
        ],
        "monthly",
        start,
      ),
      "2027-04-30",
    );
  });

  test("the anchor is the start date's day, not the open instalment's", () => {
    // A Jan 30 loan capped to Feb 28 goes back to the 30th, not to the 28th.
    assert.equal(extensionDueDate([{ due_date: "2027-02-28", status: "pending" }], "monthly", "2027-01-30"), "2027-03-30");
    // A start date carrying a time still reads as its calendar day.
    assert.equal(
      extensionDueDate([{ due_date: "2027-02-28", status: "pending" }], "monthly", "2027-01-31 00:00:00"),
      "2027-03-31",
    );
  });

  test("a day-stepped loan extends by its fixed days, as before", () => {
    assert.equal(extensionDueDate([{ due_date: "2027-01-31", status: "pending" }], "weekly", "2027-01-24"), "2027-02-07");
    assert.equal(extensionDueDate([{ due_date: "2027-02-28", status: "pending" }], "semi_monthly", "2027-02-13"), "2027-03-15");
  });

  test("nothing open, nothing to extend", () => {
    assert.equal(extensionDueDate([{ due_date: "2026-01-31", status: "paid" }], "monthly", "2025-12-31"), null);
    assert.equal(extensionDueDate([], "monthly", "2025-12-31"), null);
  });

  test("no readable start date, no anchor to step to", () => {
    const open = [{ due_date: "2027-02-28", status: "pending" as const }];
    assert.equal(extensionDueDate(open, "monthly", undefined), null);
    assert.equal(extensionDueDate(open, "monthly", null), null);
    assert.equal(extensionDueDate(open, "monthly", ""), null);
  });
});
