import { test } from "node:test";
import assert from "node:assert/strict";
import {
  instalments,
  maturityDate,
  rateForDays,
  ratePeriodWord,
  readRateFrequency,
  readTermUnit,
  termDays,
  termUnitNoun,
} from "./loan-terms";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("term unit: anything but days reads as months, the backend default", () => {
  assert.equal(readTermUnit("days"), "days");
  assert.equal(readTermUnit(" DAYS "), "days");
  assert.equal(readTermUnit("months"), "months");
  assert.equal(readTermUnit(undefined), "months");
  assert.equal(readTermUnit(null), "months");
  assert.equal(termUnitNoun("days"), "day(s)");
  assert.equal(termUnitNoun("months"), "month(s)");
  assert.equal(termDays(3, "months"), 90);
  assert.equal(termDays(45, "days"), 45);
});

/** Due dates, and the maturity date, of a months term paid monthly. */
const monthly = (start: Date, term: number) => ({
  due: instalments(start, term, "months", "monthly").map((r) => iso(r.dueDate)),
  maturity: iso(maturityDate(start, term, "months", "monthly")),
});

test("a months term paid monthly falls due on the start's day each month", () => {
  const rows = instalments(day(2026, 1, 15), 6, "months", "monthly");
  assert.deepEqual(rows.map((r) => iso(r.dueDate)), [
    "2026-02-15",
    "2026-03-15",
    "2026-04-15",
    "2026-05-15",
    "2026-06-15",
    "2026-07-15",
  ]);
  assert.deepEqual(rows.map((r) => r.days), [30, 30, 30, 30, 30, 30]);
  assert.equal(iso(maturityDate(day(2026, 1, 15), 6, "months", "monthly")), "2026-07-15");
});

test("a 31st start caps to the last day of a short month, then returns to the 31st", () => {
  assert.deepEqual(monthly(day(2027, 1, 31), 4), {
    due: ["2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"],
    maturity: "2027-05-31",
  });
  assert.deepEqual(
    instalments(day(2027, 1, 31), 4, "months", "monthly").map((r) => r.days),
    [30, 30, 30, 30]
  );
});

test("in a leap year a 31st start falls due on Feb 29", () => {
  assert.deepEqual(monthly(day(2028, 1, 31), 3), {
    due: ["2028-02-29", "2028-03-31", "2028-04-30"],
    maturity: "2028-04-30",
  });
});

test("a 30th start caps only in February and stays on the 30th after it", () => {
  assert.deepEqual(monthly(day(2026, 9, 30), 6), {
    due: ["2026-10-30", "2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"],
    maturity: "2027-03-30",
  });
});

test("a 29th start caps to Feb 28 in a common year and keeps Feb 29 in a leap year", () => {
  assert.deepEqual(monthly(day(2027, 1, 29), 2), {
    due: ["2027-02-28", "2027-03-29"],
    maturity: "2027-03-29",
  });
  assert.deepEqual(monthly(day(2028, 1, 29), 2), {
    due: ["2028-02-29", "2028-03-29"],
    maturity: "2028-03-29",
  });
});

test("a 28th start never caps", () => {
  assert.deepEqual(monthly(day(2027, 1, 28), 3), {
    due: ["2027-02-28", "2027-03-28", "2027-04-28"],
    maturity: "2027-04-28",
  });
});

test("a month-end start rolls over the year on its anchor day", () => {
  assert.deepEqual(monthly(day(2026, 12, 31), 3), {
    due: ["2027-01-31", "2027-02-28", "2027-03-31"],
    maturity: "2027-03-31",
  });
});

test("a months term paid at maturity matures on the anchored last due date", () => {
  const rows = instalments(day(2027, 1, 31), 2, "months", "upon_maturity");
  assert.deepEqual(rows.map((r) => iso(r.dueDate)), ["2027-02-28", "2027-03-31"]);
  assert.equal(iso(maturityDate(day(2027, 1, 31), 2, "months", "upon_maturity")), "2027-03-31");
  assert.equal(iso(maturityDate(day(2027, 1, 31), 1, "months", "upon_maturity")), "2027-02-28");
});

test("maturity is the last due date for every month-end start and term", () => {
  for (let year = 2026; year <= 2029; year++) {
    for (let month = 1; month <= 12; month++) {
      for (const startDay of [28, 29, 30, 31]) {
        const start = day(year, month, startDay);
        if (start.getDate() !== startDay) continue;
        for (let term = 1; term <= 24; term++) {
          const { due, maturity } = monthly(start, term);
          assert.equal(maturity, due[due.length - 1], `${iso(start)} for ${term} months`);
        }
      }
    }
  }
});

test("a start on days 1-28 dates exactly as the old chained month step did", () => {
  // The algorithm this replaced: each due date one month after the previous
  // one, and maturity one jump of `term` months from the start. Neither can
  // overflow from a day that every month has.
  const chained = (start: Date, term: number) => {
    const dates: Date[] = [];
    let date = start;
    for (let i = 1; i <= term; i++) {
      date = new Date(date);
      date.setMonth(date.getMonth() + 1);
      dates.push(date);
    }
    return dates;
  };
  const jumped = (start: Date, term: number) => {
    const date = new Date(start);
    date.setMonth(date.getMonth() + term);
    return date;
  };

  for (let year = 2026; year <= 2029; year++) {
    for (let month = 1; month <= 12; month++) {
      for (let startDay = 1; startDay <= 28; startDay++) {
        // A time of day, as a start picked "now" carries, must survive too.
        const start = new Date(year, month - 1, startDay, 14, 30);
        for (const term of [1, 2, 3, 6, 12, 18, 24, 36]) {
          for (const frequency of ["monthly", "upon_maturity"]) {
            const label = `${iso(start)} ${frequency} for ${term} months`;
            const rows = instalments(start, term, "months", frequency);
            assert.deepEqual(
              rows.map((r) => r.dueDate.getTime()),
              chained(start, term).map((d) => d.getTime()),
              label
            );
            assert.ok(rows.every((r) => r.days === 30), label);
            assert.equal(
              maturityDate(start, term, "months", frequency).getTime(),
              jumped(start, term).getTime(),
              label
            );
          }
        }
      }
    }
  }
});

test("a 45-day weekly term is six weeks and a three-day instalment", () => {
  const rows = instalments(day(2026, 1, 15), 45, "days", "weekly");
  assert.deepEqual(rows.map((r) => iso(r.dueDate)), [
    "2026-01-22",
    "2026-01-29",
    "2026-02-05",
    "2026-02-12",
    "2026-02-19",
    "2026-02-26",
    "2026-03-01",
  ]);
  assert.deepEqual(rows.map((r) => r.days), [7, 7, 7, 7, 7, 7, 3]);
  assert.equal(iso(maturityDate(day(2026, 1, 15), 45, "days", "weekly")), "2026-03-01");
});

test("a days term paid monthly steps 30 days; paid daily, one day", () => {
  assert.deepEqual(
    instalments(day(2026, 1, 15), 90, "days", "monthly").map((r) => iso(r.dueDate)),
    ["2026-02-14", "2026-03-16", "2026-04-15"]
  );
  const daily = instalments(day(2026, 1, 15), 30, "days", "daily");
  assert.equal(daily.length, 30);
  assert.equal(iso(daily[29].dueDate), "2026-02-14");
});

test("a months term paid semi-monthly is two 15-day instalments a month", () => {
  const rows = instalments(day(2026, 1, 15), 6, "months", "semi_monthly");
  assert.equal(rows.length, 12);
  assert.equal(iso(rows[11].dueDate), "2026-07-14");
  assert.equal(iso(maturityDate(day(2026, 1, 15), 6, "months", "semi_monthly")), "2026-07-14");
});

test("a days term paid at maturity is a single instalment", () => {
  const rows = instalments(day(2026, 1, 15), 45, "days", "upon_maturity");
  assert.equal(rows.length, 1);
  assert.equal(iso(rows[0].dueDate), "2026-03-01");
  assert.equal(rows[0].days, 45);
});

test("interest accrues for the days an instalment covers", () => {
  // One full period is the quoted rate exactly — a monthly loan is unchanged.
  assert.equal(rateForDays(3, 30), 0.03);
  // 45 days at 3% a month is 4.5%.
  assert.equal(Math.round(100000 * rateForDays(3, 45)), 4500);
});

test("a rate converts from the period it is quoted per, on a 30-day month", () => {
  assert.equal(readRateFrequency("weekly"), "weekly");
  assert.equal(readRateFrequency(" Daily "), "daily");
  assert.equal(readRateFrequency(undefined), "monthly");
  assert.equal(readRateFrequency("upon_maturity"), "monthly");
  assert.equal(ratePeriodWord("bi_weekly"), "bi-weekly period");

  // 1% of 60,000, for one 30-day monthly instalment, per rate frequency.
  const month = (frequency: Parameters<typeof rateForDays>[2]) =>
    Math.round(60000 * rateForDays(1, 30, frequency) * 100) / 100;
  assert.equal(month("daily"), 18000);
  assert.equal(month("weekly"), 2571.43);
  assert.equal(month("bi_weekly"), 1285.71);
  assert.equal(month("semi_monthly"), 1200);
  assert.equal(month("monthly"), 600);

  // A week at 1% a week is exactly 1%; three days of it, 3/7.
  assert.equal(rateForDays(1, 7, "weekly"), 0.01);
  assert.equal(Math.round(70000 * rateForDays(1, 3, "weekly") * 100) / 100, 300);
});
