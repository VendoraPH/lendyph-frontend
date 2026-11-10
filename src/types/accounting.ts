/**
 * Double-entry accounting domain types.
 *
 * These mirror the backend's `/accounting` API. The Phase 2 round B shapes
 * (statements, dashboard, Loan Accounting, journal preview, column books and
 * the paged lists' `meta`) are built from the round's backend contracts; see
 * `API_ENDPOINTS.ACCOUNTING` for the paths.
 *
 * MONEY IS IN CENTAVOS. Every amount in this file is an integer number of
 * centavos, never pesos, and never a float. A trial balance has to prove
 * `debit === credit` exactly, and 0.1 + 0.2 !== 0.3 in IEEE-754 — a portfolio
 * of a few thousand entries summed as pesos will drift off balance by a
 * centavo and there is no honest way to explain that to an auditor. Convert at
 * the edges with `toCentavos` / `fromCentavos` in `@/lib/accounting/money`.
 */

import type { PaginatedResponse } from "./api";

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

/** The cash flow statement section an account's movements land in. */
export type AccountCashFlowCategory = "operating" | "investing" | "financing" | "cash";

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
  /** Set by the server from the type and cash kind unless someone chose it. */
  cash_flow_category?: AccountCashFlowCategory | null;
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
  | "credit_loss"
  | "share_capital"
  | "closing"
  // Savings & Deposits (Phase 3): deposits, withdrawals and closing payouts;
  // interest runs and the interest credited at close; time deposit
  // placements; and their maturity, rollover and pre-termination.
  | "savings"
  | "savings_interest"
  | "time_deposit"
  | "time_deposit_settlement";

/**
 * `draft` is editable and affects nothing. `posted` is live and immutable —
 * correcting it means posting a `reversed` counter-entry, never deleting it,
 * so the audit trail keeps both halves visible.
 */
export type JournalStatus = "draft" | "posted" | "reversed";

/**
 * What kind of document raised an entry.
 *
 * An API alias, never a class name: the server maps its known classes to
 * `loan` / `repayment` / `expense` / `expense_payment` / `loan_adjustment` /
 * `share_capital_entry` / `gcash_transaction` and snake-cases the
 * basename of anything it has not curated. So this is deliberately OPEN — a
 * posting type nobody has mapped yet arrives as an unrecognised string rather
 * than not arriving at all, and code that switches on it needs a default.
 */
export type JournalPostableType =
  | "loan"
  | "repayment"
  | "expense"
  | "expense_payment"
  | "loan_adjustment"
  | "share_capital_entry"
  | "gcash_transaction"
  | "accounting_year_close_entry"
  | "savings_transaction"
  | "savings_interest_run"
  | "time_deposit"
  | (string & {});

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
  /** The number of the entry a reversal undoes ("JE-000154"); null otherwise. */
  reverses_journal_no?: string | null;
  /** Set on an entry that has been reversed, pointing at its reversal. */
  reversed_by_journal_id?: number | null;
  /**
   * False when the entry can't be reversed from the journal (savings postings
   * are undone from savings), with the server's reason. Absent from servers
   * before backend slice S5: then the page decides as it always has.
   */
  reversible?: boolean;
  not_reversible_reason?: string | null;
  /**
   * The source document that caused this entry, when one did.
   *
   * All three are absent or null together, and legitimately so: a fund
   * transfer IS the document, a reversal is refused a postable on purpose
   * (it points at what it undoes through `reverses_journal_id`), and a manual
   * entry never had one.
   */
  postable_type?: JournalPostableType | null;
  postable_id?: number | null;
  /**
   * The document's own identifier — loan account number, receipt number,
   * payee. Server-side this is `whenLoaded`, so the KEY can be missing from
   * the payload entirely rather than merely null. Absence means "the label was
   * not resolved", never "there is no source document" — read `postable_type`
   * for that.
   */
  postable_label?: string | null;
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
  /**
   * The bucket's share of `total`, from the server: two decimals, half up
   * ("12.50"), and "0.00" when the total is 0.
   */
  share_percent: string;
}

/** A full aged-receivables report. Also the shape the aging endpoint returns. */
export interface Aging {
  as_of: string;
  rows: AgingRow[];
  /** Centavos across every bucket. */
  total: number;
  /** Centavos in everything except `current`. */
  past_due_total: number;
  /** Loans across every bucket, from the server. */
  count_total: number;
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
  /**
   * The part of the payment that settled nothing — `repayments.overpayment`.
   *
   * `repayments.amount_paid` is NOT bounded by what is owed (StoreRepaymentRequest
   * validates only `numeric, min:0.01`), so a borrower can hand over more than
   * the schedule asks for and the excess is persisted rather than refused. It
   * is money the organisation is HOLDING, not money it has earned, so the
   * posting rule credits it to `borrower_advances` — a liability — and never to
   * an income account.
   *
   * Optional because the ordinary payment has none, and `used()` drops the
   * empty leg.
   */
  overpayment?: number;
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
  /**
   * Where each release deduction is credited, by type: Service Fee, Notarial
   * Fee, Insurance Premium, Share Capital, and any other configured catalog
   * fee. Any other deduction, and any unitemised remainder, stays on
   * `processing_fee_income`.
   */
  service_fee_income: number;
  notarial_fees_payable: number;
  insurance_premium_payable: number;
  share_capital: number;
  other_fee_income: number;
  /**
   * Where each tax withheld at release is credited, as a liability owed to
   * the government: a Documentary Stamp Tax (2230), a withholding tax (2210),
   * and any other tax (2220). Without 2230 or 2210, the backend falls back to
   * `other_taxes_payable`.
   */
  documentary_stamp_tax_payable: number;
  withholding_tax_payable: number;
  other_taxes_payable: number;
  credit_loss_expense: number;
  allowance_credit_losses: number;
  accounts_payable: number;
  /**
   * Where an overpayment is parked until it is applied or refunded.
   *
   * Deliberately NOT `accounts_payable`: that role is a trade payable owned by
   * the expenses side of this module, and an obligation to a supplier is not an
   * obligation to a borrower — sharing one account would make a payables ageing
   * report unreadable. Defaults to 2300 Other Liabilities, which the seeded
   * chart already carries, so this adds a role without adding an account.
   */
  borrower_advances: number;
  /** The charge on a GCash Cash In or Cash Out (4090). */
  gcash_service_income: number;
  /** Where a balance adjustment clears against loans receivable (1180). */
  loan_adjustments: number;
  /**
   * Interest and penalty a restructure capitalised into the new loan's
   * principal, not yet earned (1210). A contra asset, like the allowance.
   */
  unearned_restructure_income: number;
  /** Where the year-end close moves the year's result (3030 on a company chart). */
  net_surplus: number;
  /** Money received that cannot be identified yet, held until it is (2390). */
  suspense: number;
  /**
   * Savings & Deposits (Phase 3). Mapped on a cooperative chart (2050, 2060,
   * 5160 and 2210); a lending company chart has no deposit accounts, so they
   * stay unmapped there and a savings product can't be turned on.
   */
  savings_deposits?: number | null;
  time_deposits?: number | null;
  interest_expense_deposits?: number | null;
  withholding_tax_deposits?: number | null;
}

/** The savings posting roles, which only a cooperative chart maps by default. */
export type SavingsPostingRole =
  | "savings_deposits"
  | "time_deposits"
  | "interest_expense_deposits"
  | "withholding_tax_deposits";

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
  /** Centavos still owed, from the server (`amount - amount_paid`, never below 0). */
  amount_due: number;
}

/**
 * ─── Statements and books, built by the server ───
 *
 * Every statement, book and summary below is a whole document the server
 * builds and totals; the browser only displays it. Not paged.
 */

/**
 * What a statement line stands for. `account` is one account's figure; the
 * others are lines the server derives with no account of their own.
 */
export type ReportLineKind = "account" | "loan_releases" | "restructure_collections";

/** One line on a statement section. */
export interface ReportLine {
  /** Null on the derived lines (`kind` other than `account`). */
  account_id?: number | null;
  /** Null on the derived lines too. */
  account_code?: string | null;
  label: string;
  /** Centavos, signed in the direction the section reads. */
  amount: number;
  kind: ReportLineKind;
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
  /** Amounts withheld at release. Outside every section total. */
  non_cash: CashFlowNonCash;
  /** True when the three sections add up to `net_change`. */
  is_reconciled: boolean;
  /** Centavos: `net_change` less the sections' total. Zero when reconciled. */
  unexplained: number;
}

/** "Withheld at release (non-cash)": fees and deductions kept back from proceeds, by account. */
export interface CashFlowNonCash {
  label: string;
  lines: ReportLine[];
  /** Centavos. */
  total: number;
}

/** `earnings` is the derived "Earnings not yet closed" row, with no account of its own. */
export type EquityChangeRowKind = "account" | "earnings";

export interface EquityChangeRow {
  label: string;
  account_id: number | null;
  account_code: string | null;
  kind: EquityChangeRowKind;
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
  /** Gross receivable less the allowance and the unearned restructure income. */
  loans_receivable_net: number;
  loans_receivable_gross: number;
  /** 1200, a contra asset. */
  allowance_for_credit_losses: number;
  /** 1210, a contra asset. */
  unearned_restructure_income: number;
  /** 1180 Loan Adjustments Clearing. Should be zero. */
  adjustments_clearing: number;
  /** True for any non-zero 1180 balance. */
  adjustments_clearing_needs_review: boolean;
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
  /** The name of the period covering `as_of` while it is open, else null. */
  open_period?: string | null;
  /** The period covering `as_of`, open or closed; null when none does. */
  current_period: AccountingPeriodSummary | null;
  /** Income and expenses from `period.from` to `as_of` (`period.to`). Centavos. */
  period: {
    from: string;
    to: string;
    income: number;
    expenses: number;
    net_income: number;
  };
  /** Each money account's balance at `as_of`. */
  cash_accounts: DashboardCashAccount[];
  /**
   * Past due by the grace rule, from the loan records, always as of today
   * (loan records keep no history); `as_of` says which day. Centavos.
   */
  past_due: {
    as_of: string;
    amount: number;
    count: number;
  };
  /** The 12 months ending with `as_of`'s month, oldest first. */
  months: DashboardMonth[];
  /** The 10 latest posted or reversed journals dated on or before `as_of`. */
  recent_journals: RecentJournal[];
}

export type AccountingPeriodSummary = Pick<
  AccountingPeriod,
  "id" | "code" | "name" | "start_date" | "end_date" | "status"
>;

/** One month of the dashboard's trend. Centavos. */
export interface DashboardMonth {
  /** "YYYY-MM". */
  month: string;
  income: number;
  expenses: number;
  net_income: number;
  /** The money accounts' balance at month end (at `as_of` for the last month). */
  cash: number;
}

export interface RecentJournal {
  id: number;
  journal_no: string;
  date: string;
  source: JournalSource;
  description: string;
  branch_name: string | null;
  /** Centavos: the journal's total debit. */
  amount: number;
}

export interface DashboardCashAccount {
  account_id: number;
  account_code: string;
  account_name: string;
  cash_kind: CashAccountKind;
  /** Centavos. */
  balance: number;
}

/** A balance sheet line. A contra line is negative. */
export type BalanceSheetLineKind = "account" | "prior_period_earnings" | "current_year_earnings";

export interface BalanceSheetLine {
  /** Null on the two derived earnings lines, which have no account. */
  account_id: number | null;
  account_code: string | null;
  account_name: string;
  /** Centavos. */
  amount: number;
  kind: BalanceSheetLineKind;
}

/** The balance sheet at `as_of`. Centavos. */
export interface BalanceSheet {
  as_of: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_and_equity: number;
  current_year_earnings: number;
  prior_period_earnings: number;
  earnings_basis: "period";
  earnings_period: { from: string; to: string };
  /** Centavos, from the server. Zero on healthy books. */
  difference: number;
  is_balanced: boolean;
}

/** One income or expense account's movement over the period. */
export interface IncomeStatementLine {
  account_id: number;
  account_code: string;
  account_name: string;
  /** Centavos. */
  amount: number;
}

/** The income statement from `period.from` to `period.to`. Centavos. */
export interface IncomeStatement {
  period: { from: string; to: string };
  income: IncomeStatementLine[];
  expenses: IncomeStatementLine[];
  total_income: number;
  total_expenses: number;
  /** Negative on a loss. */
  net_income: number;
}

/** One line sent to the journal preview. Centavos. Accounts are not checked. */
export interface JournalPreviewLine {
  account_id?: number | null;
  debit: number;
  credit: number;
}

/** The server's totals for the lines being typed. Centavos. */
export interface JournalPreview {
  total_debit: number;
  total_credit: number;
  /** `total_debit - total_credit`. */
  difference: number;
  /** The size of `difference`. */
  out_by: number;
  heavier_side: "debit" | "credit" | null;
  is_balanced: boolean;
  line_count: number;
}

/** A member on an accounting row: never contact or personal fields. */
export interface AccountingMemberRef {
  id: number;
  name: string;
  code: string | null;
}

/** One loan on the Loan Accounting list. Centavos. */
export interface LoanAgingRow {
  loan_id: number;
  /** Null on an imported loan, which has no account number. */
  account_number: string | null;
  member: AccountingMemberRef;
  branch: { id: number; name: string } | null;
  display_status: string;
  oldest_late_due_date: string | null;
  days_past_due: number;
  bucket: AgingBucket;
  is_past_due: boolean;
  outstanding_principal: number;
  total_outstanding: number;
  past_due_amount: number;
}

/** One member on the Loan Accounting list (`group=member`): the member's worst loan. Centavos. */
export interface MemberAgingRow {
  member: AccountingMemberRef;
  loan_count: number;
  outstanding_principal: number;
  total_outstanding: number;
  past_due_amount: number;
  days_past_due: number;
  bucket: AgingBucket;
}

/** The Loan Accounting summary. Centavos. */
export interface LoanAccountingSummary {
  as_of: string;
  aging: Aging;
  /**
   * The ledger at `as_of`. Absent until the server reads the books for this
   * summary; the screen shows a dash for each figure meanwhile.
   */
  books?: {
    gross: number;
    allowance: number;
    unearned_income: number;
    adjustments_clearing: number;
    /** The server's flag: true whenever Loan Adjustments Clearing holds a balance. */
    adjustments_clearing_needs_review: boolean;
    net: number;
  };
  /** The loan records, always as of today; `as_of` says which day. */
  records: {
    as_of: string;
    loan_count: number;
    outstanding_principal: number;
    total_outstanding: number;
    past_due_amount: number;
    past_due_count: number;
  };
  /** Today's books principal against today's records. Absent, like `books`, until it is sent. */
  books_vs_records?: {
    as_of: string;
    books_principal: number;
    records_principal: number;
    /** `books_principal - records_principal`. */
    difference: number;
    is_reconciled: boolean;
  };
}

export type ColumnBookKind = "cash_receipts" | "cash_disbursements";

/**
 * One journal in a column book. Centavos. `money` is keyed by account id and
 * `columns` by mapping role; a key with no amount is left out.
 */
export interface ColumnBookRow {
  journal_id: number;
  journal_no: string;
  date: string;
  reference: string | null;
  /** The journal's description. */
  particulars: string;
  money: Partial<Record<string, number>>;
  columns: Partial<Record<string, number>>;
  sundry: Array<{
    account_code: string;
    account_name: string;
    debit: number;
    credit: number;
  }>;
}

/**
 * A cash book in columns: one money column per money account that moved, one
 * column per mapped account role, then sundry. Printed whole, not paged.
 */
export interface ColumnBook {
  kind: ColumnBookKind;
  from: string;
  to: string;
  money_columns: Array<{ account_id: number; account_code: string; account_name: string }>;
  /** `key` is the mapping role, `label` the mapped account's name. */
  columns: Array<{ key: string; label: string }>;
  rows: ColumnBookRow[];
  totals: {
    money: Partial<Record<string, number>>;
    columns: Partial<Record<string, number>>;
    sundry_debit: number;
    sundry_credit: number;
    total_debit: number;
    total_credit: number;
  };
  is_balanced: boolean;
}

/**
 * ─── Paged lists with the server's own figures ───
 *
 * Each page carries `meta.totals` over every matching row (not the page) and,
 * where sent, `meta.stats` (counts ignoring the status or bucket filter).
 */
type PageWithMeta<T, Extra> = Omit<PaginatedResponse<T>, "meta"> & {
  meta: PaginatedResponse<T>["meta"] & Extra;
};

/** The general ledger's figures over the whole range, every page. Centavos. */
export interface LedgerMeta {
  /** The account's balance before `from`, every source. */
  opening_balance: number;
  /** The account's balance at `to`, every source. */
  closing_balance: number;
  /** The matching rows over the whole range. */
  total_debit: number;
  total_credit: number;
}

export type GeneralLedgerPage = PageWithMeta<LedgerEntry, LedgerMeta>;

export type JournalPage = PageWithMeta<
  JournalEntry,
  {
    totals: { count: number; total_debit: number; total_credit: number };
    stats: Record<JournalStatus, number>;
  }
>;

export type ExpensePage = PageWithMeta<
  Expense,
  {
    totals: { count: number; amount: number; amount_paid: number; amount_due: number };
    stats: Record<ExpenseStatus, number>;
  }
>;

export type CashAccountPage = PageWithMeta<
  Account,
  {
    /** Over every money account in the caller's branch scope, not the page. */
    totals: { balance: number; by_kind: Record<CashAccountKind, number> };
  }
>;

export type LoanAgingPage<Row extends LoanAgingRow | MemberAgingRow = LoanAgingRow> = PageWithMeta<
  Row,
  {
    totals: {
      count: number;
      outstanding_principal: number;
      total_outstanding: number;
      past_due_amount: number;
    };
    /** Rows per bucket, ignoring the `bucket` filter. */
    stats: Record<AgingBucket, number>;
  }
>;

/**
 * ─── Round C: templates, opening balances, year-end, allowance,
 * reconciliation actions and attachments ───
 *
 * Built from the round's backend contracts (brief-ac1 to brief-ac6). Money is
 * integer centavos, as everywhere in this file; rates are strings, never
 * rounded.
 */

/** Which chart a fresh organisation is seeded with. The server defaults to `lending_company`. */
export type ChartTemplate = "lending_company" | "cooperative";

/** A user named on a record: who finalised, closed, posted or uploaded. */
export interface AccountingUserRef {
  id: number;
  name: string;
}

export interface AccountingBranchRef {
  id: number;
  name: string;
}

export interface AccountingJournalRef {
  id: number;
  journal_no: string;
}

export interface AccountingAccountRef {
  id: number;
  code: string;
  name: string;
}

/** An accounting period named on a close: the months it closed, or would close. */
export interface AccountingPeriodRef {
  id: number;
  name: string;
}

// ── Opening balances (C2) ──

/**
 * `none`: nothing saved and no opening journal. `posted_elsewhere`: an
 * `opening_balance` journal exists that this screen didn't post (the CLI ran).
 */
export type OpeningBalanceStatus = "none" | "draft" | "finalised" | "posted_elsewhere";

export interface OpeningBalanceLine {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  /** Centavos. Exactly one side is above zero. */
  debit: number;
  credit: number;
}

/** The 3050 line the server offers for the difference. The screen never adds it by itself. */
export interface OpeningBalanceSuggestedLine {
  account_id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

/** The one organisation-wide opening entry, with no branch. */
export interface OpeningBalance {
  status: OpeningBalanceStatus;
  /** Null when `status` is `none`. */
  id: number | null;
  as_of: string | null;
  /** In code order. */
  lines: OpeningBalanceLine[];
  total_debit: number;
  total_credit: number;
  /** `total_debit - total_credit`, from the server. */
  difference: number;
  /** Two or more lines, and total debit equals total credit above zero. */
  is_balanced: boolean;
  /** The line on 3050 Opening Balance Equity, if there is one. */
  opening_equity_line: OpeningBalanceLine | null;
  /** Null when balanced, or when 3050 is missing from the chart. */
  suggested_opening_equity_line: OpeningBalanceSuggestedLine | null;
  /** Posted journals dated on or before `as_of`: a warning figure. */
  posted_journals_on_or_before_as_of: number;
  journal: AccountingJournalRef | null;
  edit_version: number;
  finalised_at: string | null;
  finalised_by: AccountingUserRef | null;
  can_edit: boolean;
  can_finalise: boolean;
  /** Why finalising would be refused, in words. */
  blocking_reasons: string[];
  /**
   * Notices in words that never block finalising, such as a contra account on
   * its unusual side (a debit on 1200). Absent from an older API.
   */
  warnings?: string[];
}

export interface OpeningBalanceDraftLine {
  account_id: number;
  /** Centavos. Exactly one side above zero. */
  debit: number;
  credit: number;
}

/** The PUT body. `lines` replaces the draft's lines wholesale (at most 500, may be empty). */
export interface OpeningBalanceDraft {
  as_of: string;
  lines: OpeningBalanceDraftLine[];
  /** The version last read; a stale one answers 409. */
  edit_version?: number;
}

// ── Year-end close (C3) ──

export type YearCloseStatus = "closed" | "reopened";

/** One closing entry: one per branch, plus one for journals with no branch. */
export interface YearCloseEntry {
  /** Null for the no-branch entry, shown with `branches:view_all` only. */
  branch: AccountingBranchRef | null;
  journal: AccountingJournalRef;
  /** Centavos, signed: a profit is positive. */
  net_surplus: number;
}

export interface YearClose {
  id: number;
  year: number;
  status: YearCloseStatus;
  /** Centavos, signed. The sum of the entries the caller sees. */
  net_surplus: number;
  net_surplus_account: AccountingAccountRef;
  entries: YearCloseEntry[];
  periods_closed: AccountingPeriodRef[];
  closed_at: string;
  closed_by: AccountingUserRef | null;
  reopened_at: string | null;
  reopened_by: AccountingUserRef | null;
  reopen_reason: string | null;
}

export type YearClosePage = PageWithMeta<
  YearClose,
  {
    /** Over the matching rows the caller sees, not the page. */
    totals: { net_surplus: number };
  }
>;

export interface YearClosePreviewLine {
  account_id: number;
  account_code: string;
  account_name: string;
  type: AccountType;
  /** The account's net for the year, positive as it normally reads. */
  amount: number;
}

/** A branch with income or expense activity in the year; null is the no-branch journals. */
export interface YearClosePreviewBranch {
  branch: AccountingBranchRef | null;
  lines: YearClosePreviewLine[];
  total_income: number;
  total_expenses: number;
  net_surplus: number;
}

export interface YearClosePreview {
  year: number;
  /** "YYYY-12-31", the closing entries' date. */
  as_of: string;
  net_surplus_account: AccountingAccountRef;
  branches: YearClosePreviewBranch[];
  total_income: number;
  total_expenses: number;
  net_surplus: number;
  periods_to_close: AccountingPeriodRef[];
  /** Draft journals dated in the year; any blocks the close. */
  draft_journals: number;
  can_close: boolean;
  blocking_reasons: string[];
}

// ── Allowance for credit losses (C4) ──

/** Days from the oldest unpaid instalment's due date. `91_120` and `over_120` take the over-90 rate. */
export type AllowanceBucket = "1_30" | "31_60" | "61_90" | "91_120" | "over_120";

export interface AllowanceRate {
  bucket: AllowanceBucket;
  label: string;
  /** "5", "15", "25", "50". Never rounded. */
  rate_percent: string;
}

export interface AllowanceBucketRow {
  bucket: AllowanceBucket;
  loan_count: number;
  principal: number;
  rate_percent: string;
  /** Rounded half up to the centavo by the server. */
  required: number;
}

/** One branch of the preview. Every active branch appears, with zeros where there's nothing. */
export interface AllowanceBranch {
  branch: AccountingBranchRef;
  buckets: AllowanceBucketRow[];
  principal: number;
  required: number;
  /** The branch's 1200 balance, as a positive credit. */
  current_balance: number;
  /** `required - current_balance`, from the server: positive provides, negative releases. */
  adjustment: number;
}

export interface AllowancePreview {
  as_of: string;
  rates: AllowanceRate[];
  branches: AllowanceBranch[];
  totals: {
    loan_count: number;
    principal: number;
    required: number;
    current_balance: number;
    /** Sent back as `expected_adjustment` when posting. */
    adjustment: number;
  };
  /** The 1200 balance on journals with no branch, shown and left alone. */
  unassigned_balance: number;
  last_posting: {
    as_of: string;
    posted_at: string;
    posted_by: AccountingUserRef | null;
  } | null;
  can_post: boolean;
  blocking_reasons: string[];
}

/** One branch's posting in a run. `journal` is null when that branch's adjustment was 0. */
export interface AllowancePosting {
  id: number;
  branch: AccountingBranchRef;
  required: number;
  previous_balance: number;
  adjustment: number;
  journal: AccountingJournalRef | null;
}

/** What posting the allowance answers: one run, one posting per branch. */
export interface AllowanceRun {
  /** A uuid shared by the run's postings. */
  run_id: string;
  as_of: string;
  postings: AllowancePosting[];
  totals: { required: number; previous_balance: number; adjustment: number };
}

/** A row of the postings list: a posting with its run. */
export interface AllowancePostingRow extends AllowancePosting {
  run_id: string;
  as_of: string;
  created_by: AccountingUserRef | null;
  created_at: string;
}

export type AllowancePostingPage = PageWithMeta<
  AllowancePostingRow,
  {
    /** Over every matching row, not the page. */
    totals: { adjustment: number };
  }
>;

/** The provisioning report's `principal_basis` bucket keys. `91_120` and `over_120` fold into `over_90`. */
export type ProvisioningBasisBucket = "1_30" | "31_60" | "61_90" | "over_90";

/**
 * `GET /reports/provisioning`'s `principal_basis`: the allowance calculator's
 * figures in PESOS with two decimals, like the rest of `/reports`, converted
 * once by the server. Not centavos.
 */
export interface ProvisioningPrincipalBasis {
  buckets: Record<
    ProvisioningBasisBucket,
    { principal: number; count: number; rate_percent: string; required_allowance: number }
  >;
  totals: { principal: number; count: number; required_allowance: number };
  basis_note: string;
}

// ── Reconciliation actions (C5) ──

export interface ReconcileLineAsExpenseBody {
  expense_account_id: number;
  /** Required, at most 255 characters. */
  payee: string;
  /** At most 500 characters. */
  description?: string;
}

export interface ReconcileLineAsTransferBody {
  /** A money account other than the reconciled one. */
  counter_account_id: number;
  description?: string;
}

export interface ReconcileLineToSuspenseBody {
  description?: string;
}

/**
 * What each action answers: the reconciliation exactly as its show route
 * answers it, with the line now matched, and the record the action created.
 */
export interface ReconciliationActionResult {
  data: Reconciliation;
  created: {
    type: "expense" | "transfer" | "journal";
    id: number;
    journal_id: number;
    journal_no: string;
  };
}

// ── Attachments (C6) ──

/** A file on a journal or an expense. At most 20 per owner. */
export interface AccountingAttachment {
  id: number;
  label: string | null;
  original_filename: string;
  mime_type: string;
  /** Bytes. */
  file_size: number;
  /** A signed, short-lived link: read it when opening, never store it. */
  url: string;
  uploaded_by: AccountingUserRef | null;
  created_at: string;
  /** The caller may remove it now (draft journal, or `accounting:settings`). */
  can_remove: boolean;
}
