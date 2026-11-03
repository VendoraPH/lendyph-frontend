/**
 * Daily-balance interest, worked as an illustration.
 *
 * The product form uses this to show what a rate means ("₱100,000 at 2% earns
 * ₱5.48 a day"). Posted interest is never computed here: batches come from
 * the server, which stores each account's inputs. This file states the same
 * formula the handoff asks the backend for, so the two can be checked
 * against each other.
 *
 *   daily interest = end-of-day balance × annual rate ÷ days in year
 *   period interest = Σ daily interest over the days the balance was at or
 *                     above the minimum balance to earn interest,
 *                     rounded to the centavo once, at the end.
 *
 * `365` basis: every year has 365 days. `actual`: 366 in a leap year.
 */
import type { DayCountBasis } from "@/types/savings";

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number, basis: DayCountBasis): number {
  return basis === "actual" && isLeapYear(year) ? 366 : 365;
}

/** One day's interest on `balance` at `ratePct` percent a year, unrounded. */
export function dailyInterest(
  balance: number,
  ratePct: number,
  basis: DayCountBasis,
  year: number,
): number {
  if (!(balance > 0) || !(ratePct > 0)) return 0;
  return (balance * (ratePct / 100)) / daysInYear(year, basis);
}

export interface DailyBalance {
  /** `YYYY-MM-DD`. Only the year is read, for the leap-year rule. */
  date: string;
  balance: number;
}

export interface PeriodInterest {
  /** Rounded to the centavo, once. */
  interest: number;
  eligibleDays: number;
  averageDailyBalance: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Interest over a run of end-of-day balances. A day below `minBalance`
 * earns nothing and is not an eligible day; the average daily balance is
 * over every day given.
 */
export function periodInterest(
  days: DailyBalance[],
  ratePct: number,
  basis: DayCountBasis,
  minBalance = 0,
): PeriodInterest {
  let total = 0;
  let eligibleDays = 0;
  let sum = 0;
  for (const { date, balance } of days) {
    sum += balance;
    if (balance < minBalance || !(balance > 0)) continue;
    eligibleDays += 1;
    total += dailyInterest(balance, ratePct, basis, Number.parseInt(date.slice(0, 4), 10));
  }
  return {
    interest: round2(total),
    eligibleDays,
    averageDailyBalance: days.length ? round2(sum / days.length) : 0,
  };
}

/** Days in a calendar month, for "a month at this balance" examples. */
export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
