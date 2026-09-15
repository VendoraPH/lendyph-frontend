/**
 * Double-entry accounting domain types.
 *
 * These mirror the API the backend still has to build — nothing under
 * `/accounting` exists yet — so they are written as the contract we want
 * rather than as a description of what is currently returned. See
 * `API_ENDPOINTS.ACCOUNTING` for the endpoint list these imply — all of it
 * proposed, none of it live yet.
 *
 * MONEY IS IN CENTAVOS. Every amount in this file is an integer number of
 * centavos, never pesos, and never a float. A trial balance has to prove
 * `debit === credit` exactly, and 0.1 + 0.2 !== 0.3 in IEEE-754 — a portfolio
 * of a few thousand entries summed as pesos will drift off balance by a
 * centavo and there is no honest way to explain that to an auditor. Convert at
 * the edges with `toCentavos` / `fromCentavos` in `@/lib/accounting/money`.
 */

/** The five statement classifications every account rolls up into. */
export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense";

/**
 * Which side increases the account.
 *
 * Normally implied by `AccountType` (assets and expenses are debit-normal, the
 * rest credit-normal), but contra accounts invert it: "1200 Allowance for
 * Credit Losses" and "1490 Accumulated Depreciation" are assets that carry a
 * credit balance and REDUCE the assets they sit under. Storing this explicitly
 * rather than deriving it from the type is what lets Net Loans Receivable come
 * out as Gross minus Allowance instead of Gross plus Allowance.
 */
export type NormalBalance = "debit" | "credit";

/** Where the money physically sits. Drives the Cash & Bank screen. */
export type CashAccountKind = "cash" | "bank" | "gcash" | "maya" | "wallet";

export interface Account {
  id: number;
  /** "1010". Sorts lexically into statement order by construction. */
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  /** True for allowance/accumulated-depreciation style accounts. */
  is_contra: boolean;
  /** Parent account id, or null for a top-level header like "1000 Assets". */
  parent_id: number | null;
  /**
   * Header accounts (1000, 1100, 1400…) group their children and must never
   * be posted to directly — the balance shown against them is the sum of the
   * subtree, so posting to both the parent and a child would double-count.
   */
  is_group: boolean;
  is_active: boolean;
  /** Set when the account is one of the money accounts in Cash & Bank. */
  cash_kind?: CashAccountKind | null;
  description?: string | null;
  /**
   * Whether any posted journal line references this account. The UI uses it to
   * disable Delete — an account with history can only be deactivated, or the
   * ledger loses the other half of entries that already exist.
   */
  has_transactions?: boolean;
  /**
   * Centavos, signed in the account's normal direction. Optional because it is
   * a reporting figure the list endpoints attach, not part of the account
   * itself — a chart row fetched for a picker has no balance and needs none.
   */
  balance?: number;
}

/** One side of one entry. Exactly one of debit/credit is non-zero. */
export interface JournalLine {
  id?: number;
  account_id: number;
  /** Denormalised for display so the ledger table need not join client-side. */
  account_code?: string;
  account_name?: string;
  description?: string | null;
  /** Centavos. */
  debit: number;
  /** Centavos. */
  credit: number;
}

/**
 * Where a journal came from. Recorded on every entry so any figure on any
 * statement can be traced back to the lending transaction that caused it,
 * which is the whole point of the automatic engine.
 */
export type JournalSource =
  | "loan_release"
  | "loan_collection"
  | "penalty"
  | "loan_fee"
  | "gcash"
  | "cash_transaction"
  | "bank_transaction"
  | "cash_in"
  | "cash_out"
  | "expense"
  | "payable"
  | "transfer"
  | "manual"
  | "adjustment"
  | "reversal"
  | "opening_balance"
  | "credit_loss";

/**
 * `draft` is editable and affects nothing. `posted` is live and immutable —
 * correcting it means posting a `reversed` counter-entry, never deleting it,
 * so the audit trail keeps both halves visible.
 */
export type JournalStatus = "draft" | "posted" | "reversed";

export interface JournalEntry {
  id: number;
  /** "JE-000154". Assigned by the server on post, not on draft. */
  journal_no: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  source: JournalSource;
  /** The originating document: "COL-10254", "LN-000154". */
  reference?: string | null;
  description: string;
  branch_id: number | null;
  branch_name?: string | null;
  status: JournalStatus;
  lines: JournalLine[];
  /** Centavos. Server-computed totals; always equal on a posted entry. */
  total_debit: number;
  total_credit: number;
  /** Set on a reversal, pointing at the entry it undoes. */
  reverses_journal_id?: number | null;
  /** Set on an entry that has been reversed, pointing at its reversal. */
  reversed_by_journal_id?: number | null;
  created_by?: string | null;
  created_at?: string;
  posted_by?: string | null;
  posted_at?: string | null;
}

/** A draft line in the manual-entry form, before amounts are validated. */
export interface JournalLineDraft {
  account_id: number | null;
  description: string;
  /** Raw text straight from the input — "1,500.50", "" or garbage. */
  debit: string;
  credit: string;
}

export interface JournalEntryDraft {
  date: string;
  reference: string;
  branch_id: number | null;
  description: string;
  lines: JournalLineDraft[];
}

/** One row of the trial balance. */
export interface TrialBalanceRow {
  account_id: number;
  account_code: string;
  account_name: string;
  type: AccountType;
  /** Centavos. Exactly one of these is non-zero for a given account. */
  debit: number;
  credit: number;
}

export interface TrialBalance {
  as_of: string;
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  /** `total_debit - total_credit`. Zero on healthy books. */
  difference: number;
  is_balanced: boolean;
}

/** A single posting in an account's history, carrying its running balance. */
export interface LedgerEntry {
  journal_id: number;
  journal_no: string;
  date: string;
  source: JournalSource;
  reference?: string | null;
  description: string;
  branch_id: number | null;
  debit: number;
  credit: number;
  /** Centavos, signed in the account's normal direction. */
  running_balance: number;
}

/** Receivable aging buckets. Ordered oldest-last, as reports present them. */
export type AgingBucket =
  | "current"
  | "1_30"
  | "31_60"
  | "61_90"
  | "91_120"
  | "over_120";

export interface AgingRow {
  bucket: AgingBucket;
  /** Centavos. */
  amount: number;
  count: number;
}

/** A full aged-receivables report. Also the shape the aging endpoint returns. */
export interface Aging {
  as_of: string;
  rows: AgingRow[];
  /** Centavos across every bucket. */
  total: number;
  /** Centavos in everything except `current`. */
  past_due_total: number;
}

/** How a payment reached us. Selects which asset account gets debited. */
export type SettlementMethod = "cash" | "gcash" | "maya" | "bank";

/**
 * The breakdown supplied BY the loan engine when a payment is collected.
 *
 * The accounting engine must never infer this split. Principal/interest
 * allocation is an amortisation decision that belongs to the loan module; if
 * accounting re-derived it, the ledger and the loan balance would disagree the
 * moment either side changed its rounding.
 */
export interface PaymentAllocation {
  /** Centavos. */
  principal: number;
  interest: number;
  penalty: number;
  /** Processing/service fees collected alongside the payment. */
  fees?: number;
}

/** The lending events the posting engine reacts to. */
export type PostingEvent =
  | "loan_release"
  | "loan_collection"
  | "expense_cash"
  | "expense_accrual"
  | "payable_payment"
  | "fund_transfer"
  | "wallet_charge"
  | "loan_fee"
  | "credit_loss_provision"
  | "opening_balance";

/**
 * Which account each role in a posting rule resolves to.
 *
 * Configurable rather than hard-coded because organisations differ — a
 * cooperative posts membership fees somewhere a lending corporation does not,
 * and IFRS 9 treats fees tied to originating a financial asset differently
 * from fees recognised immediately. Section 19 of the spec exposes this as
 * Accounting Settings → Default Accounts.
 */
export interface AccountMapping {
  cash: number;
  gcash: number;
  maya: number;
  bank: number;
  loans_receivable: number;
  interest_receivable: number;
  penalty_receivable: number;
  interest_income: number;
  penalty_income: number;
  processing_fee_income: number;
  credit_loss_expense: number;
  allowance_credit_losses: number;
  accounts_payable: number;
}

/** Accounting periods lock the books once an accountant signs them off. */
export type PeriodStatus = "open" | "closed";

export interface AccountingPeriod {
  id: number;
  /** "2026-09". */
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  closed_by?: string | null;
  closed_at?: string | null;
}

/** Reconciliation of a money account against an external statement. */
export type ReconciliationMatch = "matched" | "unmatched" | "possible";

export interface ReconciliationLine {
  journal_id: number | null;
  date: string;
  description: string;
  /** Centavos, signed: positive is money in. */
  amount: number;
  match: ReconciliationMatch;
  /** Present on rows imported from the external statement. */
  external_reference?: string | null;
}

export interface Reconciliation {
  account_id: number;
  period: string;
  /** Centavos. What Lendy's ledger says. */
  book_balance: number;
  /** Centavos. What the bank/GCash statement says. */
  statement_balance: number;
  /** `book_balance - statement_balance`. */
  difference: number;
  lines: ReconciliationLine[];
}

/** Expense and payable tracking. */
export type ExpenseStatus = "unpaid" | "partially_paid" | "paid" | "overdue";

export interface Expense {
  id: number;
  date: string;
  payee: string;
  /** The 5xxx account the cost lands in. */
  expense_account_id: number;
  expense_account_name?: string;
  /** Centavos. */
  amount: number;
  amount_paid: number;
  /** Null when the expense was accrued rather than paid on the spot. */
  payment_account_id: number | null;
  branch_id: number | null;
  reference?: string | null;
  description?: string | null;
  due_date?: string | null;
  status: ExpenseStatus;
  journal_id?: number | null;
}

/**
 * ─── Reports the backend has to produce itself ───
 *
 * The balance sheet and income statement are NOT here: both are pure
 * regroupings of the trial balance, so `@/lib/accounting/statements` builds
 * them client-side from the rows the trial-balance endpoint already returns.
 * Adding endpoints for them would create a second source of truth for figures
 * that must agree exactly.
 *
 * The three below cannot be derived that way. A cash flow statement needs to
 * know which movements were operating, investing or financing — a
 * classification that lives on the account, not in its balance. The statement
 * of changes in equity needs opening balances and the movements between them.
 * The BIR books need each journal's lines in registration order. All three
 * need the server.
 */

/** One line on a statement section. */
export interface ReportLine {
  account_id?: number;
  account_code?: string;
  label: string;
  /** Centavos, signed in the direction the section reads. */
  amount: number;
}

export interface ReportSection {
  label: string;
  lines: ReportLine[];
  total: number;
}

export interface CashFlowStatement {
  from: string;
  to: string;
  operating: ReportSection;
  investing: ReportSection;
  financing: ReportSection;
  /** Centavos. Sum of the three sections. */
  net_change: number;
  opening_cash: number;
  closing_cash: number;
}

export interface EquityChangeRow {
  label: string;
  /** Centavos. */
  beginning: number;
  additions: number;
  deductions: number;
  ending: number;
}

export interface EquityChanges {
  from: string;
  to: string;
  rows: EquityChangeRow[];
  total_beginning: number;
  total_ending: number;
}

/** The four books of account BIR requires a registered business to keep. */
export type BookKind =
  | "general_journal"
  | "general_ledger"
  | "cash_receipts"
  | "cash_disbursements";

export interface BookRow {
  date: string;
  journal_no: string;
  reference?: string | null;
  particulars: string;
  account_code?: string;
  account_name?: string;
  /** Centavos. */
  debit: number;
  credit: number;
}

export interface AccountingBook {
  kind: BookKind;
  from: string;
  to: string;
  rows: BookRow[];
  total_debit: number;
  total_credit: number;
}

/**
 * The accounting dashboard's figures.
 *
 * Every one of these is a summary the server must compute — deriving them in
 * the browser would mean pulling the whole ledger down to add it up, and the
 * numbers would drift the moment the page was open while someone posted.
 */
export interface AccountingDashboard {
  as_of: string;
  /** Centavos. */
  cash_on_hand: number;
  cash_in_bank: number;
  e_wallets: number;
  /** Gross receivable less the allowance. */
  loans_receivable_net: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  /** Month to date. */
  income_mtd: number;
  expenses_mtd: number;
  net_income_mtd: number;
  /** Entries still in draft, waiting for someone to post them. */
  unposted_journals: number;
  /** False means the books do not balance and nothing else here is safe. */
  is_balanced: boolean;
  /** The period currently accepting entries, e.g. "2026-09". */
  open_period?: string | null;
}
