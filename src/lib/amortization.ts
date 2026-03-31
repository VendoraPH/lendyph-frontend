import { addMonths, addDays } from "date-fns";

// ── Types ──

export type InterestMethod = "fixed" | "diminishing" | "upon_maturity";
export type PaymentFrequency = "daily" | "weekly" | "bi_weekly" | "monthly";

export interface AmortizationInput {
  principal: number;
  monthlyRate: number; // % per month (e.g. 3 means 3%)
  termMonths: number;
  frequency: PaymentFrequency;
  interestMethod: InterestMethod;
  startDate: Date;
}

export interface AmortizationRow {
  period: number;
  dueDate: Date;
  beginningBalance: number;
  principal: number;
  interest: number;
  penalty: number;
  totalDue: number;
  endingBalance: number;
}

export interface ScheduleSummary {
  totalPrincipal: number;
  totalInterest: number;
  totalPayable: number;
  numberOfPayments: number;
  perPeriodPayment: number | null; // null when varies (diminishing)
  firstPayment: number;
  lastPayment: number;
  maturityDate: Date;
}

export interface GeneratedSchedule {
  rows: AmortizationRow[];
  summary: ScheduleSummary;
}

// ── Helpers ──

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get number of payment periods based on term and frequency.
 * Uses accurate multipliers: weekly ≈ 4.33/month, bi-weekly ≈ 2.17/month.
 */
export function getPeriodsCount(
  termMonths: number,
  frequency: PaymentFrequency,
  interestMethod?: InterestMethod
): number {
  if (interestMethod === "upon_maturity") return 1;

  switch (frequency) {
    case "monthly":
      return termMonths;
    case "bi_weekly":
      return Math.round(termMonths * 2.17);
    case "weekly":
      return Math.round(termMonths * 4.33);
    case "daily":
      return Math.round(termMonths * 30);
    default:
      return termMonths;
  }
}

/**
 * Get due date for a specific period based on start date and frequency.
 */
export function getDueDate(
  startDate: Date,
  periodIndex: number,
  frequency: PaymentFrequency
): Date {
  switch (frequency) {
    case "monthly":
      return addMonths(startDate, periodIndex);
    case "bi_weekly":
      return addDays(startDate, periodIndex * 14);
    case "weekly":
      return addDays(startDate, periodIndex * 7);
    case "daily":
      return addDays(startDate, periodIndex);
    default:
      return addMonths(startDate, periodIndex);
  }
}

// ── Schedule Generators ──

function generateFixed(input: AmortizationInput): AmortizationRow[] {
  const { principal, monthlyRate, termMonths, frequency, startDate } = input;
  const periods = getPeriodsCount(termMonths, frequency);
  const principalPerPeriod = round(principal / periods);
  const interestPerPeriod = round(principal * (monthlyRate / 100));
  const rows: AmortizationRow[] = [];
  let remaining = principal;

  for (let i = 1; i <= periods; i++) {
    const beginningBalance = round(remaining);
    const isLast = i === periods;
    const periodPrincipal = isLast ? round(remaining) : principalPerPeriod;
    const periodInterest = interestPerPeriod;
    remaining -= periodPrincipal;
    const endingBalance = isLast ? 0 : round(remaining);

    rows.push({
      period: i,
      dueDate: getDueDate(startDate, i, frequency),
      beginningBalance,
      principal: periodPrincipal,
      interest: periodInterest,
      penalty: 0,
      totalDue: round(periodPrincipal + periodInterest),
      endingBalance,
    });
  }

  return rows;
}

function generateDiminishing(input: AmortizationInput): AmortizationRow[] {
  const { principal, monthlyRate, termMonths, frequency, startDate } = input;
  const periods = getPeriodsCount(termMonths, frequency);
  const principalPerPeriod = round(principal / periods);
  const rows: AmortizationRow[] = [];
  let remaining = principal;

  for (let i = 1; i <= periods; i++) {
    const beginningBalance = round(remaining);
    const isLast = i === periods;
    const periodPrincipal = isLast ? round(remaining) : principalPerPeriod;
    const periodInterest = round(remaining * (monthlyRate / 100));
    remaining -= periodPrincipal;
    const endingBalance = isLast ? 0 : round(remaining);

    rows.push({
      period: i,
      dueDate: getDueDate(startDate, i, frequency),
      beginningBalance,
      principal: periodPrincipal,
      interest: periodInterest,
      penalty: 0,
      totalDue: round(periodPrincipal + periodInterest),
      endingBalance,
    });
  }

  return rows;
}

function generateUponMaturity(input: AmortizationInput): AmortizationRow[] {
  const { principal, monthlyRate, termMonths, startDate } = input;
  const totalInterest = round(principal * (monthlyRate / 100) * termMonths);
  const maturityDate = addMonths(startDate, termMonths);

  return [
    {
      period: 1,
      dueDate: maturityDate,
      beginningBalance: principal,
      principal,
      interest: totalInterest,
      penalty: 0,
      totalDue: round(principal + totalInterest),
      endingBalance: 0,
    },
  ];
}

// ── Main API ──

/**
 * Generate a complete amortization schedule with rows and summary.
 */
export function generateSchedule(input: AmortizationInput): GeneratedSchedule {
  let rows: AmortizationRow[];

  switch (input.interestMethod) {
    case "fixed":
      rows = generateFixed(input);
      break;
    case "diminishing":
      rows = generateDiminishing(input);
      break;
    case "upon_maturity":
      rows = generateUponMaturity(input);
      break;
    default:
      rows = generateFixed(input);
  }

  const totalPrincipal = round(rows.reduce((s, r) => s + r.principal, 0));
  const totalInterest = round(rows.reduce((s, r) => s + r.interest, 0));
  const totalPayable = round(totalPrincipal + totalInterest);
  const numberOfPayments = rows.length;
  const firstPayment = rows[0]?.totalDue ?? 0;
  const lastPayment = rows[rows.length - 1]?.totalDue ?? 0;

  // Per-period payment is constant for fixed and upon_maturity, null for diminishing
  const perPeriodPayment =
    input.interestMethod === "diminishing" ? null : firstPayment;

  const maturityDate =
    rows.length > 0 ? rows[rows.length - 1]!.dueDate : input.startDate;

  return {
    rows,
    summary: {
      totalPrincipal,
      totalInterest,
      totalPayable,
      numberOfPayments,
      perPeriodPayment,
      firstPayment,
      lastPayment,
      maturityDate,
    },
  };
}
