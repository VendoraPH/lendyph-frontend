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

test("a months term paid monthly steps one calendar month after the last due date", () => {
  // As the server steps it: 31 Jan overflows to 3 Mar, and every later
  // instalment follows from there.
  const rows = instalments(day(2026, 1, 31), 3, "months", "monthly");
  assert.deepEqual(rows.map((r) => iso(r.dueDate)), ["2026-03-03", "2026-04-03", "2026-05-03"]);
  assert.deepEqual(rows.map((r) => r.days), [30, 30, 30]);
  assert.equal(iso(maturityDate(day(2026, 1, 15), 6, "months", "monthly")), "2026-07-15");
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
