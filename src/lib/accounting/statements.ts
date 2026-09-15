/**
 * Balance sheet and income statement, assembled from the trial balance.
 *
 * Both statements read the SAME trial balance rows. That is the point: a
 * report must never compute its own version of a figure, or two screens end up
 * disagreeing about the month's income and there is no way to tell which is
 * right. Everything here is a regrouping of one set of numbers.
 */

import { formatDateISO } from "@/lib/format";
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

/**
 * Which window `current_year_earnings` actually covers.
 *
 * `"period"` means an opening trial balance was supplied and the figure is the
 * movement since it — the same arithmetic the income statement does, so the two
 * agree. `"cumulative"` means none was, and the figure is every peso earned
 * since the books opened. The two are wildly different numbers on any co-op
 * whose books have never been closed, so the UI must not label them the same
 * way, and this is what lets it tell them apart without guessing.
 */
export type EarningsBasis = "period" | "cumulative";

export interface BalanceSheet {
  as_of: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  /**
   * The earnings carried into equity so the sheet closes. Read
   * `earnings_basis` before labelling it: on `"period"` this is the current
   * year's result and matches the income statement; on `"cumulative"` it is
   * everything ever earned.
   */
  current_year_earnings: number;
  /**
   * Earnings banked BEFORE the period opened and never closed into Retained
   * Earnings. Always 0 on a `"cumulative"` sheet, where it is folded into
   * `current_year_earnings` instead.
   */
  prior_period_earnings: number;
  earnings_basis: EarningsBasis;
  /** The window `current_year_earnings` covers. Null on a `"cumulative"` sheet. */
  earnings_period: StatementPeriod | null;
  /** `total_assets - (total_liabilities + total_equity)`. Zero when sound. */
  difference: number;
  is_balanced: boolean;
}

/**
 * The day before an ISO date — the date an opening trial balance carries.
 *
 * A period that starts on 1 September opens with the books as they stood at
 * the close of 31 August, so every "opening" fetch in this module is dated the
 * day before its `from`. Lives here rather than in either report because BOTH
 * statements need it now: the income statement to difference its two balances,
 * and the balance sheet to find the start of the financial year.
 *
 * `formatDateISO` rather than `toISOString().slice(0, 10)`: the latter is UTC,
 * so in Manila (UTC+8) it hands back the wrong day for the whole evening and
 * the opening balance would silently be taken a day early. The repo's eslint
 * config makes that an error for exactly this reason.
 */
export function dayBefore(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return formatDateISO(date);
}

/**
 * The first day of the financial year containing `iso`.
 *
 * What "Current Year Earnings" means on a balance sheet is fixed by accounting
 * convention — year to date from the start of the financial year — and not by
 * whatever range the user last typed into the statements filter bar. Deriving
 * it from `asOf` rather than from the shared `from` filter is what lets the
 * balance sheet stay a position on a date while still agreeing with the income
 * statement, whose own default period is this same year.
 *
 * Sliced off the ISO string rather than round-tripped through `Date`, which
 * would reintroduce the timezone hazard `dayBefore` exists to avoid.
 */
export function startOfFinancialYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
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

/**
 * Period movement: closing balances minus opening balances, account by account.
 *
 * A trial balance is cumulative — it states where each account stands on a
 * date, not what happened during a range. An income statement for September
 * therefore is not "the trial balance at 30 September"; that figure carries
 * every peso earned since the books opened. The month's result is the
 * difference between two trial balances, which is what this computes.
 *
 * Accounts that appear only in the opening set are kept, negated: an account
 * that had a balance and now has none moved by exactly that amount, and
 * dropping it would silently lose the movement.
 */
export function subtractTrialBalances(
  closing: TrialBalanceRow[],
  opening: TrialBalanceRow[]
): TrialBalanceRow[] {
  const openingByAccount = new Map(opening.map((row) => [row.account_id, row]));
  const rows: TrialBalanceRow[] = [];

  const push = (row: TrialBalanceRow, net: number) => {
    // Re-split the signed movement onto the side it belongs on, so the result
    // is a trial balance in its own right and every consumer of one still works.
    rows.push({
      ...row,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
    });
  };

  for (const row of closing) {
    const before = openingByAccount.get(row.account_id);
    const net =
      row.debit - row.credit - (before ? before.debit - before.credit : 0);
    push(row, net);
    openingByAccount.delete(row.account_id);
  }

  for (const row of openingByAccount.values()) {
    push(row, -(row.debit - row.credit));
  }

  return rows;
}

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
 * Code for the synthetic line carrying earnings banked before the period.
 *
 * Deliberately NOT "3030 Retained Earnings", which is a real, postable account
 * in the seeded chart: if a co-op has actually posted to 3030, reusing the code
 * would put two lines with the same key and the same name in one section, and
 * anyone reconciling the statement would have no way to tell the posted balance
 * from the derived one.
 */
const PRIOR_PERIOD_EARNINGS_CODE = "3045";

/** Net income implied by a set of trial-balance rows. */
function netIncomeOf(rows: TrialBalanceRow[]): number {
  return sum(linesOf(rows, "income")) - sum(linesOf(rows, "expense"));
}

/**
 * What the business owns, owes, and is worth, as of a date.
 *
 * The part worth understanding: income and expense accounts do not appear on a
 * balance sheet, yet their net result must, or `Assets = Liabilities + Equity`
 * fails by exactly the period's profit. So net income is derived from the trial
 * balance and carried into equity as a real line on the statement, not an
 * adjustment folded into the total, because anyone checking the arithmetic
 * needs to see where it came from.
 *
 * `opening` is what makes that line honest, and omitting it was a reporting
 * bug rather than a missing nicety. A trial balance is CUMULATIVE. Handed only
 * the closing one, this derived net income from every posting since the books
 * opened and labelled the result "Current Year Earnings" — so a co-op trading
 * since 2024 with books never closed (the default state, since nothing has
 * closed them yet) saw ₱3,000,000 against an Income Statement, one tab away,
 * reading ₱750,000 for the same year. Both screens showed green. The balanced
 * badge could never have caught it: `difference` is identically zero whenever
 * the input trial balance balances, whatever this splits out of it.
 *
 * Given `opening` — the cumulative trial balance as at the day BEFORE the
 * period starts — the period's result is `closing - opening`, which is exactly
 * what `IncomeStatementReport` computes, so the two agree by construction
 * rather than by coincidence. The earlier earnings do not vanish: they are
 * shown as their own line, because they are real equity that simply has not
 * been closed into Retained Earnings yet. The two lines still sum to the
 * cumulative figure, so the sheet balances exactly as before.
 *
 * Without `opening` the old arithmetic is unavoidable, so the result says so
 * via `earnings_basis: "cumulative"` and names the line for what it is rather
 * than claiming a year it does not cover.
 */
export function buildBalanceSheet(
  rows: TrialBalanceRow[],
  asOf: string,
  opening?: { rows: TrialBalanceRow[]; period: StatementPeriod } | null
): BalanceSheet {
  const assets = linesOf(rows, "asset");
  const liabilities = linesOf(rows, "liability");
  const postedEquity = linesOf(rows, "equity");

  const cumulative = netIncomeOf(rows);
  const prior_period_earnings = opening ? netIncomeOf(opening.rows) : 0;
  // Subtraction rather than `netIncomeOf(subtractTrialBalances(...))`: the two
  // are equal, and this way the split is visibly exhaustive — prior + current
  // is the cumulative figure, so total equity is unchanged and the sheet still
  // closes.
  const current_year_earnings = cumulative - prior_period_earnings;

  const equity: StatementLine[] = [...postedEquity];
  const pushEarnings = (code: string, name: string, amount: number) => {
    // Omit a line entirely rather than show ₱0.00 on an otherwise empty sheet.
    if (amount === 0) return;
    equity.push({
      account_id: Number(code),
      account_code: code,
      account_name: name,
      amount,
    });
  };

  if (opening) {
    pushEarnings(
      PRIOR_PERIOD_EARNINGS_CODE,
      "Prior Period Earnings (not yet closed)",
      prior_period_earnings
    );
    pushEarnings(
      CURRENT_YEAR_EARNINGS_CODE,
      "Current Year Earnings",
      current_year_earnings
    );
  } else {
    pushEarnings(
      CURRENT_YEAR_EARNINGS_CODE,
      "Accumulated Earnings (not yet closed)",
      current_year_earnings
    );
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
    current_year_earnings,
    prior_period_earnings,
    earnings_basis: opening ? "period" : "cumulative",
    earnings_period: opening ? opening.period : null,
    difference,
    is_balanced: difference === 0,
  };
}
