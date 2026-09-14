/**
 * Balance sheet and income statement, assembled from the trial balance.
 *
 * Both statements read the SAME trial balance rows. That is the point: a
 * report must never compute its own version of a figure, or two screens end up
 * disagreeing about the month's income and there is no way to tell which is
 * right. Everything here is a regrouping of one set of numbers.
 */

import type {
  AccountType,
  TrialBalanceRow,
} from "@/types/accounting";

/** A single line on a statement, netted into its natural direction. */
export interface StatementLine {
  account_id: number;
  account_code: string;
  account_name: string;
  /** Centavos. Negative on a contra line, which subtracts from its section. */
  amount: number;
}

export interface StatementPeriod {
  from: string;
  to: string;
}

export interface IncomeStatement {
  period: StatementPeriod;
  income: StatementLine[];
  expenses: StatementLine[];
  total_income: number;
  total_expenses: number;
  /** Negative on a loss. */
  net_income: number;
}

export interface BalanceSheet {
  as_of: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  /** The period's profit, carried into equity so the sheet closes. */
  current_year_earnings: number;
  /** `total_assets - (total_liabilities + total_equity)`. Zero when sound. */
  difference: number;
  is_balanced: boolean;
}

/**
 * Nets a trial-balance row into the direction its section reads in.
 *
 * Debit-natured sections (assets, expenses) are debit minus credit; credit-
 * natured ones (liabilities, equity, income) are the reverse. A contra account
 * therefore comes out NEGATIVE — "1200 Allowance for Credit Losses" is a
 * credit-balanced asset and returns a negative amount, which is what makes it
 * subtract from total assets rather than add to them.
 */
function netFor(row: TrialBalanceRow): number {
  const debitNatured = row.type === "asset" || row.type === "expense";
  return debitNatured ? row.debit - row.credit : row.credit - row.debit;
}

function linesOf(rows: TrialBalanceRow[], type: AccountType): StatementLine[] {
  return rows
    .filter((row) => row.type === type)
    .map((row) => ({
      account_id: row.account_id,
      account_code: row.account_code,
      account_name: row.account_name,
      amount: netFor(row),
    }));
}

const sum = (lines: StatementLine[]): number =>
  lines.reduce((total, line) => total + line.amount, 0);

/** Profit and loss for the period. */
export function buildIncomeStatement(
  rows: TrialBalanceRow[],
  period: StatementPeriod
): IncomeStatement {
  const income = linesOf(rows, "income");
  const expenses = linesOf(rows, "expense");
  const total_income = sum(income);
  const total_expenses = sum(expenses);

  return {
    period,
    income,
    expenses,
    total_income,
    total_expenses,
    // Negative on a loss, deliberately. Clamping it would make a loss-making
    // month look break-even and would stop the balance sheet closing.
    net_income: total_income - total_expenses,
  };
}

/** Code for the synthetic equity line that carries the period's result. */
const CURRENT_YEAR_EARNINGS_CODE = "3040";

/**
 * What the business owns, owes, and is worth, as of a date.
 *
 * The part worth understanding: income and expense accounts do not appear on a
 * balance sheet, yet their net result must, or `Assets = Liabilities + Equity`
 * fails by exactly the period's profit. So net income is computed from the
 * same rows and carried into equity as "Current Year Earnings" — a real line
 * on the statement, not just an adjustment folded into the total, because
 * anyone checking the arithmetic needs to see where it came from.
 *
 * At year end the accountant closes this into Retained Earnings; until then it
 * is derived on every read, so it cannot go stale.
 */
export function buildBalanceSheet(
  rows: TrialBalanceRow[],
  asOf: string
): BalanceSheet {
  const assets = linesOf(rows, "asset");
  const liabilities = linesOf(rows, "liability");
  const postedEquity = linesOf(rows, "equity");

  const { net_income } = buildIncomeStatement(rows, { from: asOf, to: asOf });

  const equity: StatementLine[] = [...postedEquity];
  // Omit the line entirely on a book with no activity rather than showing a
  // ₱0.00 earnings row on an otherwise empty statement.
  if (net_income !== 0) {
    equity.push({
      account_id: Number(CURRENT_YEAR_EARNINGS_CODE),
      account_code: CURRENT_YEAR_EARNINGS_CODE,
      account_name: "Current Year Earnings",
      amount: net_income,
    });
  }

  const total_assets = sum(assets);
  const total_liabilities = sum(liabilities);
  const total_equity = sum(equity);
  const difference = total_assets - (total_liabilities + total_equity);

  return {
    as_of: asOf,
    assets,
    liabilities,
    equity,
    total_assets,
    total_liabilities,
    total_equity,
    current_year_earnings: net_income,
    difference,
    is_balanced: difference === 0,
  };
}
