// The calculator's monthly due dates, pinned to the server's anchored rule:
// each is counted from the start, on its day of the month, capped to the last
// day of a shorter month. date-fns `addMonths` clamps that way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchedule, getDueDate } from "./amortization";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dueDates = (start: Date, periods: number) =>
  Array.from({ length: periods }, (_, i) => iso(getDueDate(start, i + 1, "monthly")));

test("a monthly period falls due on the start's day, capped to a short month's last day", () => {
  assert.deepEqual(dueDates(day(2027, 1, 31), 4), ["2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
  assert.deepEqual(dueDates(day(2028, 1, 31), 2), ["2028-02-29", "2028-03-31"]);
  assert.deepEqual(dueDates(day(2026, 9, 30), 6).slice(4), ["2027-02-28", "2027-03-30"]);
});

test("an upon-maturity schedule matures on the same anchored date", () => {
  const schedule = (termMonths: number) =>
    generateSchedule({
      principal: 10000,
      monthlyRate: 3,
      termMonths,
      frequency: "monthly",
      interestMethod: "upon_maturity",
      startDate: day(2027, 1, 31),
    });

  assert.equal(iso(schedule(1).rows[0].dueDate), "2027-02-28");
  assert.equal(iso(schedule(2).summary.maturityDate), "2027-03-31");
});
