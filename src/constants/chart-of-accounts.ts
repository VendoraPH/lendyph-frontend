/**
 * The default Lendy chart of accounts.
 *
 * A TEMPLATE, not a fixed structure — administrators add, rename and
 * deactivate accounts, and a cooperative's equity and liability sections look
 * different from a lending corporation's (share capital, statutory funds and
 * undivided net surplus in place of capital and retained earnings). This is
 * what a new organisation is seeded with on day one.
 *
 * Codes follow the classification convention `account.ts` relies on: 1xxx
 * asset, 2xxx liability, 3xxx equity, 4xxx income, 5xxx expense. Keep it that
 * way — `accountTypeFromCode` reads the leading digit.
 */

import type {
  Account,
  AccountMapping,
  AccountType,
  CashAccountKind,
  NormalBalance,
} from "@/types/accounting";

/** A seed row. Ids are assigned by the server when the chart is created. */
export interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  /** Headings that group children and cannot be posted to. */
  is_group?: boolean;
  /** Accounts that carry the opposite balance to their type and subtract. */
  is_contra?: boolean;
  /** Set on the money accounts that appear under Cash & Bank. */
  cash_kind?: CashAccountKind;
  /** Parent code, for building the tree. Absent on top-level headings. */
  parent?: string;
}

export const DEFAULT_CHART_OF_ACCOUNTS: SeedAccount[] = [
  // ── Assets ──
  { code: "1000", name: "Assets", type: "asset", is_group: true },

  { code: "1010", name: "Cash on Hand", type: "asset", parent: "1000", cash_kind: "cash" },
  { code: "1020", name: "GCash", type: "asset", parent: "1000", cash_kind: "gcash" },
  { code: "1030", name: "Maya", type: "asset", parent: "1000", cash_kind: "maya" },
  { code: "1040", name: "Bank Accounts", type: "asset", parent: "1000", cash_kind: "bank" },

  { code: "1100", name: "Loans Receivable", type: "asset", is_group: true, parent: "1000" },
  { code: "1110", name: "Current Loans Receivable", type: "asset", parent: "1100" },
  { code: "1120", name: "Past Due Loans Receivable", type: "asset", parent: "1100" },

  { code: "1150", name: "Interest Receivable", type: "asset", parent: "1000" },
  { code: "1160", name: "Penalty Receivable", type: "asset", parent: "1000" },
  { code: "1170", name: "Other Receivables", type: "asset", parent: "1000" },

  // Credit-balanced asset: it REDUCES loans receivable. Net Loans Receivable
  // is gross minus this, which is why `is_contra` has to be set.
  {
    code: "1200",
    name: "Allowance for Credit Losses",
    type: "asset",
    is_contra: true,
    parent: "1000",
  },

  { code: "1300", name: "Prepaid Expenses", type: "asset", parent: "1000" },

  { code: "1400", name: "Property and Equipment", type: "asset", is_group: true, parent: "1000" },
  { code: "1410", name: "Office Equipment", type: "asset", parent: "1400" },
  { code: "1420", name: "Computer Equipment", type: "asset", parent: "1400" },
  {
    code: "1490",
    name: "Accumulated Depreciation",
    type: "asset",
    is_contra: true,
    parent: "1400",
  },

  // ── Liabilities ──
  { code: "2000", name: "Liabilities", type: "liability", is_group: true },

  { code: "2010", name: "Accounts Payable", type: "liability", parent: "2000" },
  { code: "2020", name: "Accrued Expenses", type: "liability", parent: "2000" },

  { code: "2100", name: "Loans Payable", type: "liability", parent: "2000" },
  { code: "2110", name: "Other Borrowings", type: "liability", parent: "2000" },

  { code: "2200", name: "Taxes Payable", type: "liability", is_group: true, parent: "2000" },
  { code: "2210", name: "Withholding Tax Payable", type: "liability", parent: "2200" },
  { code: "2220", name: "Other Taxes Payable", type: "liability", parent: "2200" },

  { code: "2300", name: "Other Liabilities", type: "liability", parent: "2000" },

  // ── Equity ──
  // A cooperative replaces these with Share Capital, Statutory Funds, Reserve
  // Fund and Undivided Net Surplus. Left as the corporate default; the
  // organisation type decides which set is seeded.
  { code: "3000", name: "Equity", type: "equity", is_group: true },
  { code: "3010", name: "Capital", type: "equity", parent: "3000" },
  { code: "3020", name: "Additional Capital", type: "equity", parent: "3000" },
  { code: "3030", name: "Retained Earnings", type: "equity", parent: "3000" },
  // A heading, never a postable account. `buildBalanceSheet` DERIVES the
  // period's result from the trial balance and pushes it into the equity
  // section as a synthetic line carrying this very code, so a real balance
  // here would put two lines with code 3040 — different names, different
  // amounts — side by side in one section with no way to tell the posted
  // figure from the derived one. The sheet still balances (`difference` is
  // identically zero whenever the trial balance balances, whatever is split
  // out of it), which is precisely why nothing would catch it. `is_group`
  // blocks posting and makes that unreachable. Year-end closing moves the
  // result into 3030 Retained Earnings.
  { code: "3040", name: "Current Year Earnings", type: "equity", is_group: true, parent: "3000" },
  // The named plug for the opening-balance difference the accounting backfill
  // computes. Folded into 3030 Retained Earnings it would be indistinguishable
  // from real earnings forever. NOT 3045 — `statements.ts` already uses that
  // code for its synthetic prior-period line.
  { code: "3050", name: "Opening Balance Equity", type: "equity", parent: "3000" },

  // ── Income ──
  { code: "4000", name: "Income", type: "income", is_group: true },
  { code: "4010", name: "Interest Income", type: "income", parent: "4000" },
  { code: "4020", name: "Penalty Income", type: "income", parent: "4000" },
  { code: "4030", name: "Loan Processing Fee Income", type: "income", parent: "4000" },
  { code: "4040", name: "Service Fee Income", type: "income", parent: "4000" },
  { code: "4050", name: "Membership Fee Income", type: "income", parent: "4000" },
  { code: "4060", name: "Other Lending Income", type: "income", parent: "4000" },
  { code: "4070", name: "Other Income", type: "income", parent: "4000" },

  // ── Expenses ──
  { code: "5000", name: "Expenses", type: "expense", is_group: true },
  { code: "5010", name: "Salaries and Wages", type: "expense", parent: "5000" },
  { code: "5020", name: "Rent", type: "expense", parent: "5000" },
  { code: "5030", name: "Electricity", type: "expense", parent: "5000" },
  { code: "5040", name: "Internet", type: "expense", parent: "5000" },
  { code: "5050", name: "Transportation", type: "expense", parent: "5000" },
  { code: "5060", name: "Office Supplies", type: "expense", parent: "5000" },
  { code: "5070", name: "Bank Charges", type: "expense", parent: "5000" },
  { code: "5080", name: "GCash Charges", type: "expense", parent: "5000" },
  { code: "5090", name: "Software Expenses", type: "expense", parent: "5000" },
  { code: "5100", name: "Professional Fees", type: "expense", parent: "5000" },
  { code: "5110", name: "Advertising", type: "expense", parent: "5000" },
  { code: "5120", name: "Communication", type: "expense", parent: "5000" },
  { code: "5130", name: "Depreciation Expense", type: "expense", parent: "5000" },
  { code: "5140", name: "Credit Loss Expense", type: "expense", parent: "5000" },
  { code: "5150", name: "Miscellaneous Expense", type: "expense", parent: "5000" },
];

/**
 * Which seeded account each posting role points at by default.
 *
 * The posting engine never hard-codes an account — it resolves through this
 * mapping, so an organisation can re-point "interest income" at its own
 * account without touching a rule. Keys mirror `AccountMapping`; values are
 * codes, resolved to ids once the chart exists.
 *
 * `satisfies` rather than a plain annotation so the literal codes survive for
 * callers that index this by key, while a role added to `AccountMapping` and
 * forgotten here fails to compile. A role with no default resolves to
 * `undefined` at the moment a loan is released, which is the worst possible
 * time to find out.
 */
export const DEFAULT_ACCOUNT_MAPPING_CODES = {
  cash: "1010",
  gcash: "1020",
  maya: "1030",
  bank: "1040",
  loans_receivable: "1110",
  interest_receivable: "1150",
  penalty_receivable: "1160",
  interest_income: "4010",
  penalty_income: "4020",
  processing_fee_income: "4030",
  credit_loss_expense: "5140",
  allowance_credit_losses: "1200",
  accounts_payable: "2010",
  // 2300 Other Liabilities, NOT 2010: an overpayment is owed to a borrower, a
  // payable is owed to a supplier, and one account for both makes a payables
  // ageing report unreadable.
  borrower_advances: "2300",
} as const satisfies Record<keyof AccountMapping, string>;

/** The normal balance a seed row implies, for building the account record. */
export function seedNormalBalance(seed: SeedAccount): NormalBalance {
  const base: NormalBalance =
    seed.type === "asset" || seed.type === "expense" ? "debit" : "credit";
  if (!seed.is_contra) return base;
  return base === "debit" ? "credit" : "debit";
}

/**
 * The seed rows as `Account` records, for screens that need a populated
 * account picker before the chart has ever been saved.
 *
 * Ids are the row index, NOT server ids — they exist so a `<Select>` has a key
 * and nothing more. Anything built from these is a preview: `useChartOfAccounts`
 * flags it as a template, and the forms refuse to submit against it. Once the
 * accounts endpoint answers, real ids replace these wholesale.
 */
export function templateAccounts(): Account[] {
  const idByCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a, i) => [a.code, i + 1]));
  return DEFAULT_CHART_OF_ACCOUNTS.map((seed, i) => ({
    id: i + 1,
    code: seed.code,
    name: seed.name,
    type: seed.type,
    normal_balance: seedNormalBalance(seed),
    parent_id: seed.parent ? (idByCode.get(seed.parent) ?? null) : null,
    is_group: seed.is_group ?? false,
    is_contra: seed.is_contra ?? false,
    cash_kind: seed.cash_kind ?? null,
    is_active: true,
    has_transactions: false,
  }));
}
