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
  scbAmount?: number; // Share Capital Build-Up per period (added to each row's totalDue)
}

export interface AmortizationRow {
  period: number;
  dueDate: Date;
  beginningBalance: number;
  principal: number;
  interest: number;
  penalty: number;
  shareCapitalBuildUp: number; // SCB added to this period's total due
  totalDue: number;
  endingBalance: number;
}

export interface ScheduleSummary {
  totalPrincipal: number;
  totalInterest: number;
  totalScb: number;
  totalPayable: number;
  numberOfPayments: number;
  perPeriodPayment: number | null; // null when varies (diminishing)
  firstPayment: number;
  lastPayment: number;
  maturityDate: Date;
  // Status counts (populated when from API)
  paidPeriods?: number;
  unpaidPeriods?: number;
  overduePeriods?: number;
  partialPeriods?: number;
  totalPaid?: number;
  totalRemaining?: number;
}

// ── API Response Types ──

export interface ApiScheduleRow {
  id: number;
  period_number: number;
  due_date: string;
  beginning_balance: number;
  principal_due: number;
  interest_due: number;
  penalty_amount: number;
  total_due: number;
  remaining_balance: number;
  principal_paid: number;
  interest_paid: number;
  penalty_paid: number;
  status: "paid" | "partial" | "overdue" | "pending";
}

export interface ApiAmortizationSchedule {
  schedule: ApiScheduleRow[];
  summary: {
    total_principal: number;
    total_interest: number;
    total_payable: number;
    total_paid: number;
    total_remaining: number;
    paid_periods: number;
    unpaid_periods: number;
    overdue_periods: number;
    partial_periods: number;
  };
}

export interface GeneratedSchedule {
  rows: AmortizationRow[];
  summary: ScheduleSummary;
}

// ── Helpers ──

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round to whole number (0 decimals) — used for principal amortization per the computation spec. */
function roundWhole(value: number): number {
  return Math.round(value);
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
  const scbPerPeriod = round(input.scbAmount ?? 0);
  const periods = getPeriodsCount(termMonths, frequency);
  // Principal per period rounded to whole number per computation spec
  const principalPerPeriod = roundWhole(principal / periods);
  const interestPerPeriod = round(principal * (monthlyRate / 100));
  const rows: AmortizationRow[] = [];
  let remaining = principal;

  for (let i = 1; i <= periods; i++) {
    const beginningBalance = round(remaining);
    const isLast = i === periods;
    // Last period gets the remaining balance to ensure total equals exactly the loan amount
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
      shareCapitalBuildUp: scbPerPeriod,
      totalDue: round(periodPrincipal + periodInterest + scbPerPeriod),
      endingBalance,
    });
  }

  return rows;
}

function generateDiminishing(input: AmortizationInput): AmortizationRow[] {
  const { principal, monthlyRate, termMonths, frequency, startDate } = input;
  const scbPerPeriod = round(input.scbAmount ?? 0);
  const periods = getPeriodsCount(termMonths, frequency);
  const r = monthlyRate / 100;

  // PMT formula: P * r / (1 - (1+r)^(-n))
  const pmt = r > 0 ? round(principal * r / (1 - Math.pow(1 + r, -periods))) : round(principal / periods);

  const rows: AmortizationRow[] = [];
  let remaining = principal;

  for (let i = 1; i <= periods; i++) {
    const beginningBalance = round(remaining);
    const isLast = i === periods;
    const periodInterest = round(remaining * r);
    const periodPrincipal = isLast ? round(remaining) : round(pmt - periodInterest);
    remaining -= periodPrincipal;
    const endingBalance = isLast ? 0 : round(remaining);
    const baseTotal = isLast ? round(periodPrincipal + periodInterest) : pmt;

    rows.push({
      period: i,
      dueDate: getDueDate(startDate, i, frequency),
      beginningBalance,
      principal: periodPrincipal,
      interest: periodInterest,
      penalty: 0,
      shareCapitalBuildUp: scbPerPeriod,
      totalDue: round(baseTotal + scbPerPeriod),
      endingBalance,
    });
  }

  return rows;
}

function generateUponMaturity(input: AmortizationInput): AmortizationRow[] {
  const { principal, monthlyRate, termMonths, frequency, startDate } = input;
  const scbPerPeriod = round(input.scbAmount ?? 0);

  if (termMonths <= 1) {
    // Single lump sum at maturity
    const totalInterest = round(principal * (monthlyRate / 100) * termMonths);
    return [{
      period: 1,
      dueDate: addMonths(startDate, termMonths),
      beginningBalance: principal,
      principal,
      interest: totalInterest,
      penalty: 0,
      shareCapitalBuildUp: scbPerPeriod,
      totalDue: round(principal + totalInterest + scbPerPeriod),
      endingBalance: 0,
    }];
  }

  // Interest-only periodic payments + principal at maturity
  const periods = getPeriodsCount(termMonths, frequency, "fixed"); // use "fixed" to get actual period count
  const interestPerPeriod = round(principal * (monthlyRate / 100));
  const rows: AmortizationRow[] = [];

  for (let i = 1; i <= periods; i++) {
    const isLast = i === periods;
    const baseTotal = isLast ? round(principal + interestPerPeriod) : interestPerPeriod;
    rows.push({
      period: i,
      dueDate: getDueDate(startDate, i, frequency),
      beginningBalance: principal,
      principal: isLast ? principal : 0,
      interest: interestPerPeriod,
      penalty: 0,
      shareCapitalBuildUp: scbPerPeriod,
      totalDue: round(baseTotal + scbPerPeriod),
      endingBalance: isLast ? 0 : principal,
    });
  }

  return rows;
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
  const totalScb = round(rows.reduce((s, r) => s + r.shareCapitalBuildUp, 0));
  const totalPayable = round(totalPrincipal + totalInterest + totalScb);
  const numberOfPayments = rows.length;
  const firstPayment = rows[0]?.totalDue ?? 0;
  const lastPayment = rows[rows.length - 1]?.totalDue ?? 0;

  // Per-period payment is constant for fixed; null for diminishing;
  // for upon_maturity with term > 1: interest-only amount (first payment), null if single lump sum
  const perPeriodPayment =
    input.interestMethod === "diminishing"
      ? null
      : input.interestMethod === "upon_maturity" && numberOfPayments > 1
        ? firstPayment
        : input.interestMethod === "upon_maturity"
          ? null
          : firstPayment;

  const maturityDate =
    rows.length > 0 ? rows[rows.length - 1]!.dueDate : input.startDate;

  return {
    rows,
    summary: {
      totalPrincipal,
      totalInterest,
      totalScb,
      totalPayable,
      numberOfPayments,
      perPeriodPayment,
      firstPayment,
      lastPayment,
      maturityDate,
    },
  };
}
