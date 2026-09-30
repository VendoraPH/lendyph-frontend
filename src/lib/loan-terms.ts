/**
 * How a loan's term, payment frequency and quoted rate become instalments —
 * the mirror of the backend's `LoanTermSchedule`, so a preview shows exactly
 * what the server will save.
 *
 * - `term` is a LENGTH in `term_unit` (months or days).
 * - The payment frequency splits it into instalments. A months term paid
 *   monthly or at maturity steps by calendar months, as loans always have (throwaway edit).
 *   Anything else is counted in days (a month is 30) and stepped by
 *   1 / 7 / 14 / 15 / 30 days, ending in a shorter instalment when the term
 *   does not split evenly.
 * - Each instalment is charged interest for the days it covers, at the rate
 *   quoted per `interest_rate_frequency`.
 */

export type TermUnit = "months" | "days";

export type RateFrequency = "daily" | "weekly" | "bi_weekly" | "semi_monthly" | "monthly";

export const DAYS_PER_MONTH = 30;

/** Days in one period of each frequency, on the 30-day-month convention. */
export const PERIOD_DAYS: Record<RateFrequency, number> = {
  daily: 1,
  weekly: 7,
  bi_weekly: 14,
  semi_monthly: 15,
  monthly: DAYS_PER_MONTH,
};

/** The unit a payload names; anything else is the backend default, months. */
export function readTermUnit(value: unknown): TermUnit {
  return String(value ?? "").trim().toLowerCase() === "days" ? "days" : "months";
}

/** The period a payload's rate is quoted per; absent means monthly. */
export function readRateFrequency(value: unknown): RateFrequency {
  const key = String(value ?? "").trim().toLowerCase();
  return key in PERIOD_DAYS ? (key as RateFrequency) : "monthly";
}

const RATE_PERIOD_WORD: Record<RateFrequency, string> = {
  daily: "day",
  weekly: "week",
  bi_weekly: "bi-weekly period",
  semi_monthly: "semi-monthly period",
  monthly: "month",
};

/** "week", "month" — as in "3% per week". */
export function ratePeriodWord(rateFrequency: RateFrequency): string {
  return RATE_PERIOD_WORD[rateFrequency];
}

/** "day(s)" / "month(s)" — the noun for a term's unit. */
export function termUnitNoun(termUnit: TermUnit): string {
  return termUnit === "days" ? "day(s)" : "month(s)";
}

export function stepsByCalendarMonth(termUnit: TermUnit, frequency: string): boolean {
  return termUnit === "months" && (frequency === "monthly" || frequency === "upon_maturity");
}

export function termDays(term: number, termUnit: TermUnit): number {
  return termUnit === "days" ? term : term * DAYS_PER_MONTH;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function periodDays(frequency: string): number {
  return PERIOD_DAYS[frequency as RateFrequency] ?? DAYS_PER_MONTH;
}

export interface Instalment {
  dueDate: Date;
  /** Days of interest this instalment carries. */
  days: number;
}

/**
 * Each instalment's due date and the days it covers. An upon-maturity loan
 * outside the calendar-month case is one instalment covering the whole term.
 */
export function instalments(
  start: Date,
  term: number,
  termUnit: TermUnit,
  frequency: string
): Instalment[] {
  if (stepsByCalendarMonth(termUnit, frequency)) {
    const rows: Instalment[] = [];
    let date = start;
    for (let i = 1; i <= term; i++) {
      // One month after the previous due date, as the server steps it.
      date = addMonths(date, 1);
      rows.push({ dueDate: date, days: DAYS_PER_MONTH });
    }
    return rows;
  }

  const totalDays = termDays(term, termUnit);
  if (frequency === "upon_maturity") {
    return [{ dueDate: addDays(start, totalDays), days: totalDays }];
  }

  const step = periodDays(frequency);
  const count = Math.ceil(totalDays / step);
  const rows: Instalment[] = [];
  for (let i = 1; i <= count; i++) {
    rows.push({
      dueDate: addDays(start, Math.min(i * step, totalDays)),
      days: i < count ? step : totalDays - (count - 1) * step,
    });
  }
  return rows;
}

/** The date the last instalment falls due. */
export function maturityDate(
  start: Date,
  term: number,
  termUnit: TermUnit,
  frequency: string
): Date {
  if (stepsByCalendarMonth(termUnit, frequency)) return addMonths(start, term);
  return addDays(start, termDays(term, termUnit));
}

/**
 * The interest, as a fraction of principal, that `days` days accrue at
 * `ratePercent` quoted per `rateFrequency`. Exactly `ratePercent / 100` when
 * the days are one rate period.
 */
export function rateForDays(
  ratePercent: number,
  days: number,
  rateFrequency: RateFrequency = "monthly"
): number {
  const rateDays = PERIOD_DAYS[rateFrequency];
  return (ratePercent / 100) * (days === rateDays ? 1 : days / rateDays);
}
