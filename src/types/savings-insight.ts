/**
 * The Savings dashboard (`GET /savings/dashboard`, gap round S5). Every figure
 * is the server's: money arrives as two-decimal peso strings and is shown as
 * sent, never added up or derived in the browser.
 */

import type { MoneyString } from "./savings";

export interface SavingsCountAmount {
  count: number;
  amount: MoneyString;
}

/** The savings subledger against GL 2050 and 2060, as of the period's end. */
export interface SavingsDashboardGlControl {
  as_of: string;
  is_balanced: boolean;
  /** How many branch and account lines differ. */
  differences: number;
  subledger_balance: MoneyString;
  gl_balance: MoneyString;
  difference: MoneyString;
  /** The server's warning in words, or null when the books agree. */
  warning: string | null;
  /** True when a product was picked: the GL has no product, so the control reads every product. */
  product_filter_ignored: boolean;
}

export interface SavingsDashboardKpis {
  /** Savings balance plus time deposits outstanding at `date_to`. */
  total_deposits: MoneyString;
  savings_balance: MoneyString;
  time_deposits: SavingsCountAmount;
  /** Today's statuses: statuses keep no history (`as_of`). */
  accounts: { active: number; dormant: number; frozen: number; as_of: string };
  new_accounts: number;
  deposits: SavingsCountAmount;
  withdrawals: SavingsCountAmount;
  net_deposit_movement: MoneyString;
  interest_credited: { gross: MoneyString; tax: MoneyString; net: MoneyString };
  /** Excess-withdrawal fees: the cooperative's income, never a withdrawal. */
  fees_charged: SavingsCountAmount;
  /** Savings moved to the member's share capital: its own figure, never a withdrawal. */
  share_capital_transfers: SavingsCountAmount;
  time_deposit_interest_paid: { gross: MoneyString; tax: MoneyString };
  maturing_30_days: { count: number; principal: MoneyString; maturity_amount: MoneyString };
  gl_control: SavingsDashboardGlControl;
}

/** One month of the series, oldest first; the last month closes at `date_to`. */
export interface SavingsDashboardMonth {
  /** "YYYY-MM". */
  month: string;
  /** "Nov 2026". */
  label: string;
  as_of: string;
  savings_balance: MoneyString;
  time_deposits: MoneyString;
  total_deposits: MoneyString;
  deposit_count: number;
  deposits: MoneyString;
  withdrawal_count: number;
  withdrawals: MoneyString;
  interest_credited: MoneyString;
  /** The month's change in total deposits (savings plus time deposits), after interest, fees and transfers. */
  net_movement: MoneyString;
}

/** One row of the deposit summary (and its totals), by branch or product. */
export interface SavingsSummaryLine {
  opening_balance: MoneyString;
  deposit_count: number;
  deposits: MoneyString;
  withdrawal_count: number;
  withdrawals: MoneyString;
  interest_credited: MoneyString;
  tax_withheld: MoneyString;
  fee_count: number;
  fees_charged: MoneyString;
  share_capital_transfer_count: number;
  share_capital_transfers: MoneyString;
  other_movements: MoneyString;
  net_movement: MoneyString;
  closing_balance: MoneyString;
  new_accounts: number;
  open_accounts: number;
  time_deposit_count: number;
  time_deposits: MoneyString;
  time_deposits_placed_count: number;
  time_deposits_placed: MoneyString;
  time_deposit_interest: MoneyString;
  interest_expense: MoneyString;
  total_deposits: MoneyString;
}

export interface SavingsSummaryRow extends SavingsSummaryLine {
  /** Null on the "No branch" row. */
  group_id: number | null;
  group_name: string;
}

export interface SavingsBreakdown {
  rows: SavingsSummaryRow[];
  totals: SavingsSummaryLine;
}

export interface SavingsMaturityBucket {
  key: string;
  /** "0–30 days", in words from the server. */
  label: string;
  from_days: number | null;
  to_days: number | null;
  count: number;
  principal: MoneyString;
  maturity_amount: MoneyString;
}

export interface SavingsDashboard {
  date_from: string;
  date_to: string;
  kpis: SavingsDashboardKpis;
  series: SavingsDashboardMonth[];
  by_product: SavingsBreakdown;
  by_branch: SavingsBreakdown;
  maturity_buckets: SavingsMaturityBucket[];
}

/** `GET /savings/dashboard` filters. Dates are YYYY-MM-DD; `to` is not after today. */
export interface SavingsDashboardQuery {
  from?: string;
  to?: string;
  branch_id?: number;
  product_id?: number;
}
