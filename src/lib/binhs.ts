import { formatDateISO } from "./format";

export const BINHS_PENALTY_RATE = 0.2;

export interface BinhsInput {
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  scbuPerPeriod: number;
  startDate: string;
}

export interface BinhsRow {
  period: number;
  dueDate: string;
  principal: number;
  interest: number;
  penalty: number;
  scbu: number;
  totalPayment: number;
  runningBalance: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** `YYYY-MM-DD`, optionally followed by a time. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * A due date is a calendar date, so it is parsed and serialised entirely in
 * local terms. `new Date("2026-08-26")` is specified to parse as UTC *midnight*
 * — 08:00 in Manila — and the month arithmetic below runs on local getters, so
 * mixing the two only happened to agree east of UTC. Reading the Y/M/D parts
 * directly keeps the schedule on the day the user picked in every timezone.
 */
function parseLocalDate(value: string): Date | null {
  const parts = DATE_ONLY.exec(value.trim());
  if (!parts) return null;
  const d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonthsISO(startDate: string, months: number): string {
  const d = parseLocalDate(startDate);
  if (!d) return startDate;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return formatDateISO(d);
}

export function isValidBinhsInput(input: BinhsInput): boolean {
  return (
    input.principal > 0 &&
    input.annualInterestRate >= 0 &&
    Number.isInteger(input.termMonths) &&
    input.termMonths >= 1 &&
    input.termMonths <= 60 &&
    input.scbuPerPeriod >= 0 &&
    !Number.isNaN(new Date(input.startDate).getTime())
  );
}

interface IdealPlan {
  monthlyRate: number;
  levelPayment: number;
  scheduledPrincipal: number[];
  scheduledInterest: number[];
}

function planIdeal(input: BinhsInput): IdealPlan {
  const r = input.annualInterestRate / 12 / 100;
  const n = input.termMonths;
  const levelPayment =
    r === 0
      ? input.principal / n
      : (input.principal * r) / (1 - Math.pow(1 + r, -n));

  const scheduledPrincipal: number[] = [];
  const scheduledInterest: number[] = [];
  let balance = input.principal;
  for (let i = 0; i < n; i++) {
    const interest = balance * r;
    const principalPaid = i === n - 1 ? balance : levelPayment - interest;
    scheduledPrincipal.push(principalPaid);
    scheduledInterest.push(interest);
    balance -= principalPaid;
  }
  return { monthlyRate: r, levelPayment, scheduledPrincipal, scheduledInterest };
}

export function buildIdealSchedule(input: BinhsInput): BinhsRow[] {
  if (!isValidBinhsInput(input)) return [];
  const plan = planIdeal(input);
  const rows: BinhsRow[] = [];
  let balance = input.principal;
  for (let i = 0; i < input.termMonths; i++) {
    const interest = round2(plan.scheduledInterest[i]);
    const principalPaid = round2(plan.scheduledPrincipal[i]);
    balance = round2(balance - principalPaid);
    const scbu = round2(input.scbuPerPeriod);
    rows.push({
      period: i + 1,
      dueDate: addMonthsISO(input.startDate, i),
      principal: principalPaid,
      interest,
      penalty: 0,
      scbu,
      totalPayment: round2(principalPaid + interest + scbu),
      runningBalance: balance < 0 ? 0 : balance,
    });
  }
  return rows;
}

export function buildWorstCaseSchedule(input: BinhsInput): BinhsRow[] {
  if (!isValidBinhsInput(input)) return [];
  const plan = planIdeal(input);
  const rows: BinhsRow[] = [];
  const scheduledPmt = plan.levelPayment;
  let carriedPrin = 0;
  let runningBalance = input.principal;
  let idealBalance = input.principal;

  for (let i = 0; i < input.termMonths; i++) {
    carriedPrin += plan.scheduledPrincipal[i];
    const penalty = carriedPrin * BINHS_PENALTY_RATE;
    let interest: number;
    if (i === 0) {
      interest = input.principal * plan.monthlyRate;
      idealBalance -= plan.scheduledPrincipal[i];
      runningBalance = idealBalance + interest + penalty;
    } else if (i === 1) {
      interest = idealBalance * plan.monthlyRate;
      runningBalance = runningBalance + interest + penalty;
    } else {
      interest = runningBalance * plan.monthlyRate;
      runningBalance = runningBalance + interest + penalty;
    }

    const scbu = round2(input.scbuPerPeriod);
    rows.push({
      period: i + 1,
      dueDate: addMonthsISO(input.startDate, i),
      principal: round2(carriedPrin),
      interest: round2(interest),
      penalty: round2(penalty),
      scbu,
      totalPayment: round2(scheduledPmt + scbu),
      runningBalance: round2(runningBalance),
    });
  }
  return rows;
}

export function buildCustomSchedule(
  input: BinhsInput,
  paidFlags: boolean[],
): BinhsRow[] {
  if (!isValidBinhsInput(input)) return [];
  const plan = planIdeal(input);
  const rows: BinhsRow[] = [];
  let outstanding = input.principal;
  let carriedPrin = 0;
  const scheduledPmt = plan.levelPayment;

  for (let i = 0; i < input.termMonths; i++) {
    const isPaid = paidFlags[i] === true;
    const scheduledPrin = plan.scheduledPrincipal[i];
    const scbu = round2(input.scbuPerPeriod);
    const interest = outstanding * plan.monthlyRate;

    if (isPaid) {
      const principalSettled = carriedPrin + scheduledPrin;
      outstanding = outstanding - principalSettled;
      carriedPrin = 0;
      rows.push({
        period: i + 1,
        dueDate: addMonthsISO(input.startDate, i),
        principal: round2(principalSettled),
        interest: round2(interest),
        penalty: 0,
        scbu,
        totalPayment: round2(principalSettled + interest + scbu),
        runningBalance: round2(outstanding < 0 ? 0 : outstanding),
      });
    } else {
      carriedPrin += scheduledPrin;
      const penalty = carriedPrin * BINHS_PENALTY_RATE;
      outstanding = outstanding + interest + penalty;
      rows.push({
        period: i + 1,
        dueDate: addMonthsISO(input.startDate, i),
        principal: round2(carriedPrin),
        interest: round2(interest),
        penalty: round2(penalty),
        scbu,
        totalPayment: round2(scheduledPmt + scbu),
        runningBalance: round2(outstanding),
      });
    }
  }
  return rows;
}

export interface BinhsTotals {
  principal: number;
  interest: number;
  penalty: number;
  scbu: number;
  totalPayment: number;
}

export function sumBinhsRows(rows: BinhsRow[]): BinhsTotals {
  return rows.reduce<BinhsTotals>(
    (acc, r) => ({
      principal: round2(acc.principal + r.principal),
      interest: round2(acc.interest + r.interest),
      penalty: round2(acc.penalty + r.penalty),
      scbu: round2(acc.scbu + r.scbu),
      totalPayment: round2(acc.totalPayment + r.totalPayment),
    }),
    { principal: 0, interest: 0, penalty: 0, scbu: 0, totalPayment: 0 },
  );
}
