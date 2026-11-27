/**
 * The Amortization (BINHS) page's inputs and display.
 *
 * Every figure comes from `POST /loans/amortization-calculator/binhs`
 * (`BinhsCalculator` on the server): the Ideal, Worst Case and Custom
 * schedules, their due dates and their totals, worked out in exact maths. The
 * browser only sends what was typed and shows the answer; it computes no
 * payment, interest, penalty, balance, total or rate.
 */
import { formatCurrency, formatDate } from "./format";

/** The server's cap on a BINHS term (`BinhsCalculator::MAX_TERM_MONTHS`). */
export const BINHS_MAX_TERM_MONTHS = 60;

/** The form, as typed. Figures stay strings, so they reach the server exactly. */
export interface BinhsInput {
  principal: string;
  /** Percent a year. */
  annualRate: string;
  termMonths: string;
  scbuPerPeriod: string;
  /** The first due date, YYYY-MM-DD. */
  startDate: string;
}

/** The body the endpoint takes for the schedules. */
export interface BinhsRequest {
  principal: string;
  annual_rate: string;
  term_months: number;
  start_date: string;
  scbu_per_period?: string;
  /** Custom: whether each period, from period 1, is paid. */
  paid_flags: boolean[];
}

/** One schedule row, every figure a 2-decimal string from the server. */
export interface BinhsRow {
  period: number;
  due_date: string;
  principal: string;
  interest: string;
  penalty: string;
  scbu: string;
  total_payment: string;
  running_balance: string;
}

/** The server's column totals (no running balance total). */
export interface BinhsTotals {
  principal: string;
  interest: string;
  penalty: string;
  scbu: string;
  total_payment: string;
}

export interface BinhsScenario {
  rows: BinhsRow[];
  totals: BinhsTotals;
}

export type BinhsScenarioKey = "ideal" | "worst_case" | "custom";

/**
 * A loan's starting inputs (`?loan_id`), its rate already a rate a year.
 * `annual_rate` is null when the year isn't a finite decimal, `term_months`
 * when the term is in days: staff enter those.
 */
export interface BinhsPrefill {
  loan_id: number;
  principal: string;
  annual_rate: string | null;
  term_months: number | null;
  start_date: string | null;
}

/** `data` of the endpoint's answer. */
export interface BinhsResult {
  prefill: BinhsPrefill | null;
  scenarios: Record<BinhsScenarioKey, BinhsScenario> | null;
}

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})(?:$|[ T])/;
const WHOLE = /^\d+$/;

/**
 * The schedules' request body, or null while a required input is missing or
 * the term isn't a whole number of months from 1 to 60. Whether a figure is in
 * range is the server's call (its 422 is shown as it is).
 */
export function binhsRequest(input: BinhsInput, paidFlags: boolean[]): BinhsRequest | null {
  const principal = input.principal.trim();
  const annualRate = input.annualRate.trim();
  const term = input.termMonths.trim();
  const date = DATE_ONLY.exec(input.startDate.trim())?.[1];
  if (!principal || !annualRate || !date || !WHOLE.test(term)) return null;
  const termMonths = Number(term);
  if (termMonths < 1 || termMonths > BINHS_MAX_TERM_MONTHS) return null;

  const body: BinhsRequest = {
    principal,
    annual_rate: annualRate,
    term_months: termMonths,
    start_date: date,
    paid_flags: paidFlags.slice(0, termMonths),
  };
  const scbu = input.scbuPerPeriod.trim();
  if (scbu) body.scbu_per_period = scbu;
  return body;
}

/** The Custom tab's paid flags for each period of the term, unpaid unless ticked. */
export function paidFlagsFor(termMonths: number, paid: Readonly<Record<number, boolean>>): boolean[] {
  const n = Number.isInteger(termMonths) && termMonths > 0 ? Math.min(termMonths, BINHS_MAX_TERM_MONTHS) : 0;
  return Array.from({ length: n }, (_, i) => paid[i] ?? false);
}

/** The form after a loan's prefill: a figure the server left null is blank. */
export function inputFromPrefill(prefill: BinhsPrefill, current: BinhsInput): BinhsInput {
  return {
    ...current,
    principal: prefill.principal,
    annualRate: prefill.annual_rate ?? "",
    termMonths: prefill.term_months === null ? "" : String(prefill.term_months),
    startDate: prefill.start_date ?? current.startDate,
  };
}

export interface BinhsDisplayRow {
  period: number;
  dueDate: string;
  principal: string;
  interest: string;
  penalty: string;
  scbu: string;
  totalPayment: string;
  runningBalance: string;
}

export interface BinhsDisplayTotals {
  principal: string;
  interest: string;
  penalty: string;
  scbu: string;
  totalPayment: string;
}

/** A scenario as the table shows it: the server's figures in pesos, dates in words. */
export function displayBinhsScenario(scenario: BinhsScenario | null | undefined): {
  rows: BinhsDisplayRow[];
  totals: BinhsDisplayTotals | null;
} {
  if (!scenario) return { rows: [], totals: null };
  return {
    rows: scenario.rows.map((row) => ({
      period: row.period,
      dueDate: formatDate(row.due_date),
      principal: formatCurrency(row.principal),
      interest: formatCurrency(row.interest),
      penalty: formatCurrency(row.penalty),
      scbu: formatCurrency(row.scbu),
      totalPayment: formatCurrency(row.total_payment),
      runningBalance: formatCurrency(row.running_balance),
    })),
    totals: {
      principal: formatCurrency(scenario.totals.principal),
      interest: formatCurrency(scenario.totals.interest),
      penalty: formatCurrency(scenario.totals.penalty),
      scbu: formatCurrency(scenario.totals.scbu),
      totalPayment: formatCurrency(scenario.totals.total_payment),
    },
  };
}
