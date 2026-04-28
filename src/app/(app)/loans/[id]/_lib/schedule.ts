// Page-private amortization schedule helpers used by the loan detail UI.
// Note: these are intentionally separate from src/lib/amortization.ts because
// the row shape (totalPayment/balance vs totalDue/endingBalance) and the
// "upon_maturity" payment frequency variant differ.

export type PaymentFrequency =
  | "daily"
  | "weekly"
  | "bi_weekly"
  | "monthly"
  | "upon_maturity";

export type InterestType = "fixed" | "diminishing" | "upon_maturity";

export interface AmortizationRow {
  period: number;
  dueDate: Date;
  principal: number;
  interest: number;
  shareCapitalBuildUp: number;
  totalPayment: number;
  balance: number;
  status?: "pending" | "paid" | "partial" | "overdue";
  amountPaid?: number;
}

export function getPeriodsFromMonths(
  termMonths: number,
  frequency: PaymentFrequency,
): number {
  switch (frequency) {
    case "upon_maturity":
      return termMonths; // SCB accumulates monthly, paid as lump sum at maturity
    case "daily":
      return Math.round(termMonths * 30);
    case "weekly":
      return Math.round(termMonths * 4.33);
    case "bi_weekly":
      return Math.round(termMonths * 2.17);
    case "monthly":
      return termMonths;
  }
}

export function getIntervalDays(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "upon_maturity":
      return 30; // fallback, not used in upon_maturity path
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "bi_weekly":
      return 14;
    case "monthly":
      return 30;
  }
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function generateSchedule(
  principal: number,
  rate: number,
  termMonths: number,
  frequency: PaymentFrequency,
  interestType: InterestType,
  startDate: Date,
  scbAmount: number = 0,
): AmortizationRow[] {
  // Upon Maturity = a single consolidated payment at the maturity date.
  // Triggered when payment_frequency OR interest_type is "upon_maturity".
  if (frequency === "upon_maturity" || interestType === "upon_maturity") {
    const totalInterest = principal * (rate / 100) * termMonths;
    const totalScb = scbAmount * termMonths; // SCB accumulates monthly, paid at maturity
    return [
      {
        period: 1,
        dueDate: addMonths(startDate, termMonths),
        principal,
        interest: totalInterest,
        shareCapitalBuildUp: totalScb,
        totalPayment: principal + totalInterest + totalScb,
        balance: 0,
      },
    ];
  }

  const totalPeriods = getPeriodsFromMonths(termMonths, frequency);
  const intervalDays = getIntervalDays(frequency);
  const principalPerPeriod = principal / totalPeriods;
  const rows: AmortizationRow[] = [];

  let remainingBalance = principal;

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate =
      frequency === "monthly"
        ? addMonths(startDate, i)
        : addDays(startDate, i * intervalDays);

    let interest: number;
    if (interestType === "fixed") {
      interest = principal * (rate / 100);
    } else {
      interest = remainingBalance * (rate / 100);
    }

    remainingBalance -= principalPerPeriod;

    rows.push({
      period: i,
      dueDate,
      principal: principalPerPeriod,
      interest,
      shareCapitalBuildUp: scbAmount,
      totalPayment: principalPerPeriod + interest + scbAmount,
      balance: Math.max(0, remainingBalance),
    });
  }

  return rows;
}
