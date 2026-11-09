/**
 * Accounting API client.
 *
 * Every call here goes to a route the backend serves under `/accounting`. The
 * backend's `routes/api.php` is the source of truth for paths and payloads;
 * see the note on `API_ENDPOINTS.ACCOUNTING`.
 *
 * Deliberately NO fixtures. Every other module here can show sample rows and
 * the worst case is a confusing demo; a ledger that shows invented figures is
 * a different kind of wrong, and someone will screenshot it. Pages that have
 * no data yet say so.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import { buildJournalPayload } from "@/lib/accounting/journal";
import type { PaginatedResponse } from "@/types";
import type {
  Account,
  AccountingAttachment,
  AccountMapping,
  AccountingBook,
  AccountingDashboard,
  AccountingPeriod,
  Aging,
  AgingBucket,
  BalanceSheet,
  BookKind,
  AllowancePostingPage,
  AllowancePreview,
  AllowanceRun,
  CashAccountPage,
  ChartTemplate,
  CashFlowStatement,
  ColumnBook,
  ColumnBookKind,
  EquityChanges,
  Expense,
  ExpensePage,
  ExpenseStatus,
  GeneralLedgerPage,
  IncomeStatement,
  JournalEntry,
  JournalEntryDraft,
  JournalPage,
  JournalPreview,
  JournalPreviewLine,
  LedgerEntry,
  LoanAccountingSummary,
  LoanAgingPage,
  LoanAgingRow,
  MemberAgingRow,
  OpeningBalance,
  OpeningBalanceDraft,
  ReconcileLineAsExpenseBody,
  ReconcileLineAsTransferBody,
  ReconcileLineToSuspenseBody,
  Reconciliation,
  ReconciliationActionResult,
  TrialBalance,
  YearClose,
  YearClosePage,
  YearClosePreview,
} from "@/types/accounting";

/**
 * One page, exactly as the endpoint handed it over.
 *
 * There used to be an `unwrapList<T>()` here that reduced all three of these to
 * `T[]`. It recognised the Laravel paginator envelope by name and returned
 * `res.data` from it — which threw `meta.total` and `meta.last_page` on the
 * floor, so nothing downstream could even ASK whether it had the whole list.
 * Combined with seven callers that passed no `per_page`, every screen in this
 * module rendered the endpoint's default page of 15 rows as if it were the
 * dataset. The union is kept honest rather than flattened: `fetchAllPages`
 * reads all three shapes, and `meta` survives to reach `DrainResult`.
 */
export type ListPage<T> = PaginatedResponse<T> | { data: T[] } | T[];

/**
 * `page` and `per_page`, which every list endpoint in this API accepts and
 * clamps at `min(per_page, 100)` with a default of 15.
 *
 * Present on the single-page methods so that asking for one page is possible
 * and deliberate. The `…ListAll` drains set both themselves — passing them
 * there has no effect.
 */
export interface PageParams {
  page?: number;
  per_page?: number;
}

export interface LedgerQuery {
  account_id?: number;
  from?: string;
  to?: string;
  branch_id?: number;
}

export interface JournalQuery {
  from?: string;
  to?: string;
  status?: JournalEntry["status"];
  source?: JournalEntry["source"];
  branch_id?: number;
}

/** From/to plus an optional branch — the shape every report filter produces. */
export interface PeriodQuery {
  from: string;
  to: string;
  branch_id?: number;
}

/** One page of an account's ledger, optionally narrowed to one journal source. */
export interface GeneralLedgerPageQuery extends LedgerQuery, PageParams {
  source?: JournalEntry["source"];
}

/** One page of the journal register. `search` matches number, reference or description. */
export interface JournalPageQuery extends JournalQuery, PageParams {
  search?: string;
}

/** One page of expenses. `search` matches payee or reference. */
export interface ExpensePageQuery extends PageParams {
  status?: ExpenseStatus;
  search?: string;
  from?: string;
  to?: string;
  branch_id?: number;
}

export interface CashAccountPageParams extends PageParams {
  branch_id?: number;
}

export type LoanAccountingGroup = "loan" | "member";

/** One page of the Loan Accounting list. 25 rows by default, at most 100. */
export interface LoanAccountingLoansQuery<G extends LoanAccountingGroup = LoanAccountingGroup>
  extends PageParams {
  as_of?: string;
  branch_id?: number;
  bucket?: AgingBucket;
  past_due_only?: boolean;
  search?: string;
  group?: G;
}

/** A row of the Loan Accounting list: a member row when grouped by member. */
export type LoanAccountingRow<G extends LoanAccountingGroup> = G extends "member"
  ? MemberAgingRow
  : LoanAgingRow;

/** Paying an expense: the date, centavos, and the money account it is paid from. */
export interface PayExpenseData {
  date: string;
  amount: number;
  account_id: number;
}

export const accountingService = {
  // ── Dashboard ──
  /** `from` starts the dashboard's period; the server defaults it to the first of `asOf`'s month. */
  dashboard: (asOf: string, branchId?: number, from?: string): Promise<AccountingDashboard> =>
    api.get<AccountingDashboard>(API_ENDPOINTS.ACCOUNTING.DASHBOARD, {
      params: { as_of: asOf, branch_id: branchId, from },
    }),

  // ── Chart of accounts ──
  /**
   * One page of the chart.
   *
   * Named `accountsList`, not `listAccounts`, and the suffix is load-bearing
   * rather than stylistic. `pagination/no-unparameterised-list` in
   * `eslint.config.mjs` matches
   * `[callee.property.name=/[lL]ist$/][arguments.length=0]`, which is how the
   * repo's other 30 bare list calls get flagged. This module was written with
   * prefix names — `listAccounts`, `listJournals`, `listExpenses` — and so
   * scored ZERO hits across seven call sites that every one of them deserved.
   * A guard that cannot see a whole module is not a guard, and renaming is
   * cheaper than a second selector that would have to be kept in step forever.
   *
   * The `…All` sibling below is excluded by the same rule for free, because it
   * ends in "All". Both halves of that convention are deliberate.
   */
  accountsList: (
    params: PageParams = {},
  ): Promise<ListPage<Account>> =>
    api.getRaw<ListPage<Account>>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_LIST, {
      params,
    }),

  /**
   * The whole chart, across as many pages as it takes.
   *
   * Every picker in the module reads this, and a chart of accounts is exactly
   * the kind of list where the missing rows are the ones you need: the default
   * template alone is 60-odd accounts, so at a page size of 15 the expense and
   * equity sections simply did not exist in any dropdown.
   */
  accountsListAll: (): Promise<DrainResult<Account>> =>
    fetchAllPages<Account>(({ page, per_page }) =>
      accountingService.accountsList({ page, per_page }),
    ),

  /**
   * Seed a fresh organisation's chart. One-time, admin-only. `template` is sent
   * only when given, so a call without one sends exactly the empty body it
   * always has and the server seeds the lending company chart.
   */
  seedAccounts: (template?: ChartTemplate): Promise<Account[]> =>
    api.post<Account[]>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_SEED, template ? { template } : {}),

  createAccount: (data: Partial<Account>): Promise<Account> =>
    api.post<Account>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_CREATE, data),

  account: (id: number): Promise<Account> =>
    api.get<Account>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_SHOW(id)),

  updateAccount: (id: number, data: Partial<Account>): Promise<Account> =>
    api.put<Account>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_UPDATE(id), data),

  /** The server refuses an account with history; deactivate it instead. */
  deleteAccount: (id: number): Promise<void> =>
    api.delete<void>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_DELETE(id)),

  // ── Journals ──
  journalsList: (
    query: JournalQuery & PageParams = {},
  ): Promise<ListPage<JournalEntry>> =>
    api.getRaw<ListPage<JournalEntry>>(API_ENDPOINTS.ACCOUNTING.JOURNALS_LIST, {
      params: query,
    }),

  /** Every journal matching `query`. The register is the last list that should stop at 15. */
  journalsListAll: (
    query: JournalQuery = {},
  ): Promise<DrainResult<JournalEntry>> =>
    fetchAllPages<JournalEntry>(({ page, per_page }) =>
      accountingService.journalsList({ ...query, page, per_page }),
    ),

  /**
   * Creates a manual entry from the form's draft.
   *
   * The conversion is here rather than in the page, and that placement is the
   * fix. `JournalEntryDraft.lines` hold RAW INPUT TEXT — the type's own comment
   * says so — and this used to hand `draft` to `api.post` untouched, so
   * `"1,500.50"` went to the ledger as the string a user typed. PHP reads that
   * as `1.0`, and `"1500.50"` as `1500.5`; the two sides of an entry the form
   * had just declared balanced were then out by ₱1,499.50, with a blank spare
   * row along for the ride.
   *
   * Every other write path in this module already converts at its own call site
   * (`expense-dialog`, `transfer-dialog`), which is precisely why this one going
   * unconverted was invisible — and it is the only one of the three that writes
   * to the ledger. Putting `buildJournalPayload` behind the service instead of
   * in the component means no future caller can reintroduce it.
   */
  createJournal: async (draft: JournalEntryDraft): Promise<JournalEntry> =>
    // `async` is load-bearing, not decoration. `buildJournalPayload` throws on
    // a draft that should never have been submitted, and without `async` that
    // throw is SYNCHRONOUS out of a function whose type says `Promise` — so
    // `createJournal(d).catch(…)` would not catch it and the rejection would
    // escape as an unhandled error. `async` turns it into the rejection the
    // signature already promises.
    api.post<JournalEntry>(
      API_ENDPOINTS.ACCOUNTING.JOURNALS_CREATE,
      buildJournalPayload(draft),
    ),

  /** One page of the register, with the server's totals and per-status counts in `meta`. */
  journalsPage: (query: JournalPageQuery = {}): Promise<JournalPage> =>
    api.getRaw<JournalPage>(API_ENDPOINTS.ACCOUNTING.JOURNALS_LIST, { params: query }),

  journal: (id: number): Promise<JournalEntry> =>
    api.get<JournalEntry>(API_ENDPOINTS.ACCOUNTING.JOURNALS_SHOW(id)),

  /**
   * Saves a draft. Converted by `buildJournalPayload`, as `createJournal` is,
   * and `async` for the same reason: its throw becomes this call's rejection.
   */
  updateJournal: async (id: number, draft: JournalEntryDraft): Promise<JournalEntry> =>
    api.put<JournalEntry>(
      API_ENDPOINTS.ACCOUNTING.JOURNALS_UPDATE(id),
      buildJournalPayload(draft),
    ),

  /** The server's totals for lines in centavos. Writes nothing. */
  previewJournal: (lines: JournalPreviewLine[]): Promise<JournalPreview> =>
    api.post<JournalPreview>(API_ENDPOINTS.ACCOUNTING.JOURNALS_PREVIEW, { lines }),

  /**
   * Posting is its own verb, not a status field on an update, because it is
   * the point of no return: after this the entry can only be reversed.
   */
  postJournal: (id: number): Promise<JournalEntry> =>
    api.post<JournalEntry>(API_ENDPOINTS.ACCOUNTING.JOURNALS_POST(id), {}),

  /** Writes a mirror entry. The original stays exactly where it is. */
  reverseJournal: (id: number, date: string, reason: string): Promise<JournalEntry> =>
    api.post<JournalEntry>(API_ENDPOINTS.ACCOUNTING.JOURNALS_REVERSE(id), { date, reason }),

  // ── Reporting ──
  generalLedgerList: (
    query: LedgerQuery & PageParams,
  ): Promise<ListPage<LedgerEntry>> =>
    api.getRaw<ListPage<LedgerEntry>>(API_ENDPOINTS.ACCOUNTING.GENERAL_LEDGER, {
      params: query,
    }),

  /**
   * An account's whole history over the range, not the first page of it.
   *
   * Worse here than on any other list in the module, because each row carries a
   * `running_balance`: a ledger cut off at row 15 does not merely hide
   * movements, it presents the balance AFTER the fifteenth entry as the
   * account's current position. The number is on screen, formatted, and wrong,
   * and there is nothing about it that looks partial.
   */
  generalLedgerListAll: (
    query: LedgerQuery,
  ): Promise<DrainResult<LedgerEntry>> =>
    fetchAllPages<LedgerEntry>(({ page, per_page }) =>
      accountingService.generalLedgerList({ ...query, page, per_page }),
    ),

  /**
   * One page of an account's ledger. `meta` carries the opening and closing
   * balances and the range's totals; with `source` each row keeps the
   * account's true running balance.
   */
  generalLedgerPage: (query: GeneralLedgerPageQuery): Promise<GeneralLedgerPage> =>
    api.getRaw<GeneralLedgerPage>(API_ENDPOINTS.ACCOUNTING.GENERAL_LEDGER, { params: query }),

  trialBalance: (asOf: string, branchId?: number): Promise<TrialBalance> =>
    api.get<TrialBalance>(API_ENDPOINTS.ACCOUNTING.TRIAL_BALANCE, {
      params: { as_of: asOf, branch_id: branchId },
    }),

  balanceSheet: (asOf: string, branchId?: number): Promise<BalanceSheet> =>
    api.get<BalanceSheet>(API_ENDPOINTS.ACCOUNTING.BALANCE_SHEET, {
      params: { as_of: asOf, branch_id: branchId },
    }),

  incomeStatement: (query: PeriodQuery): Promise<IncomeStatement> =>
    api.get<IncomeStatement>(API_ENDPOINTS.ACCOUNTING.INCOME_STATEMENT, { params: query }),

  cashFlow: (query: PeriodQuery): Promise<CashFlowStatement> =>
    api.get<CashFlowStatement>(API_ENDPOINTS.ACCOUNTING.CASH_FLOW, { params: query }),

  equityChanges: (query: PeriodQuery): Promise<EquityChanges> =>
    api.get<EquityChanges>(API_ENDPOINTS.ACCOUNTING.EQUITY_CHANGES, { params: query }),

  book: (kind: BookKind, query: PeriodQuery): Promise<AccountingBook> =>
    api.get<AccountingBook>(API_ENDPOINTS.ACCOUNTING.BOOKS[kind], { params: query }),

  /** Cash receipts or disbursements in columns. Printed whole, not paged. */
  columnBook: (kind: ColumnBookKind, query: PeriodQuery): Promise<ColumnBook> =>
    api.get<ColumnBook>(API_ENDPOINTS.ACCOUNTING.BOOK_COLUMNS[kind], { params: query }),

  receivableAging: (asOf: string, branchId?: number): Promise<Aging> =>
    api.get<Aging>(API_ENDPOINTS.ACCOUNTING.RECEIVABLE_AGING, {
      params: { as_of: asOf, branch_id: branchId },
    }),

  // ── Loan Accounting ──
  loanAccountingSummary: (asOf: string, branchId?: number): Promise<LoanAccountingSummary> =>
    api.get<LoanAccountingSummary>(API_ENDPOINTS.ACCOUNTING.LOAN_ACCOUNTING_SUMMARY, {
      params: { as_of: asOf, branch_id: branchId },
    }),

  /**
   * One page of loans, or of members with `group: "member"`. `past_due_only`
   * travels as `1` and is left out when off.
   */
  loanAccountingLoans: <G extends LoanAccountingGroup = "loan">(
    query: LoanAccountingLoansQuery<G> = {},
  ): Promise<LoanAgingPage<LoanAccountingRow<G>>> => {
    const { past_due_only, ...rest } = query;
    return api.getRaw<LoanAgingPage<LoanAccountingRow<G>>>(
      API_ENDPOINTS.ACCOUNTING.LOAN_ACCOUNTING_LOANS,
      { params: { ...rest, past_due_only: past_due_only ? 1 : undefined } },
    );
  },

  // ── Expenses ──
  expensesList: (params: PageParams = {}): Promise<ListPage<Expense>> =>
    api.getRaw<ListPage<Expense>>(API_ENDPOINTS.ACCOUNTING.EXPENSES_LIST, {
      params,
    }),

  /**
   * Every expense, because the screen totals them.
   *
   * The Expenses screen sums `amount - amount_paid` over what it holds and
   * renders it as "Outstanding ₱X" in headline type. On a co-op with 40 open
   * payables that headline was the total of the first 15 — and the status
   * filter above it narrows the same short page client-side, so filtering to
   * "Unpaid" made the figure smaller again rather than more complete.
   */
  expensesListAll: (): Promise<DrainResult<Expense>> =>
    fetchAllPages<Expense>(({ page, per_page }) =>
      accountingService.expensesList({ page, per_page }),
    ),

  /** One page, with the server's totals (amount due included) and per-status counts. */
  expensesPage: (query: ExpensePageQuery = {}): Promise<ExpensePage> =>
    api.getRaw<ExpensePage>(API_ENDPOINTS.ACCOUNTING.EXPENSES_LIST, { params: query }),

  expense: (id: number): Promise<Expense> =>
    api.get<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_SHOW(id)),

  createExpense: (data: Partial<Expense>): Promise<Expense> =>
    api.post<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_CREATE, data),

  updateExpense: (id: number, data: Partial<Expense>): Promise<Expense> =>
    api.put<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_UPDATE(id), data),

  payExpense: (id: number, data: PayExpenseData): Promise<Expense> =>
    api.post<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_PAY(id), data),

  // ── Cash and bank ──
  cashAccountsList: (params: PageParams = {}): Promise<ListPage<Account>> =>
    api.getRaw<ListPage<Account>>(API_ENDPOINTS.ACCOUNTING.CASH_ACCOUNTS_LIST, {
      params,
    }),

  /** Every money account — the screen sums their balances into one figure. */
  cashAccountsListAll: (): Promise<DrainResult<Account>> =>
    fetchAllPages<Account>(({ page, per_page }) =>
      accountingService.cashAccountsList({ page, per_page }),
    ),

  /** One page, with the balance over every money account (and by kind) in `meta.totals`. */
  cashAccountsPage: (params: CashAccountPageParams = {}): Promise<CashAccountPage> =>
    api.getRaw<CashAccountPage>(API_ENDPOINTS.ACCOUNTING.CASH_ACCOUNTS_LIST, { params }),

  transfer: (data: {
    date: string;
    from_account_id: number;
    to_account_id: number;
    amount: number;
    charge?: number;
    description: string;
  }): Promise<JournalEntry> =>
    api.post<JournalEntry>(API_ENDPOINTS.ACCOUNTING.CASH_TRANSFER, data),

  // ── Reconciliation ──
  reconciliationsList: (
    params: PageParams = {},
  ): Promise<ListPage<Reconciliation>> =>
    api.getRaw<ListPage<Reconciliation>>(
      API_ENDPOINTS.ACCOUNTING.RECONCILIATIONS_LIST,
      { params },
    ),

  reconciliationsListAll: (): Promise<DrainResult<Reconciliation>> =>
    fetchAllPages<Reconciliation>(({ page, per_page }) =>
      accountingService.reconciliationsList({ page, per_page }),
    ),

  // ── Periods ──
  periodsList: (
    params: PageParams = {},
  ): Promise<ListPage<AccountingPeriod>> =>
    api.getRaw<ListPage<AccountingPeriod>>(API_ENDPOINTS.ACCOUNTING.PERIODS_LIST, {
      params,
    }),

  /**
   * Every period. A co-op live since 2024 already has 20+ monthly periods, so
   * a default page of 15 hid the oldest ones — which are exactly the ones
   * anyone visits this screen to close.
   */
  periodsListAll: (): Promise<DrainResult<AccountingPeriod>> =>
    fetchAllPages<AccountingPeriod>(({ page, per_page }) =>
      accountingService.periodsList({ page, per_page }),
    ),

  closePeriod: (id: number): Promise<AccountingPeriod> =>
    api.post<AccountingPeriod>(API_ENDPOINTS.ACCOUNTING.PERIODS_CLOSE(id), {}),

  reopenPeriod: (id: number): Promise<AccountingPeriod> =>
    api.post<AccountingPeriod>(API_ENDPOINTS.ACCOUNTING.PERIODS_REOPEN(id), {}),

  // ── Settings ──
  getAccountMapping: (): Promise<AccountMapping> =>
    api.get<AccountMapping>(API_ENDPOINTS.ACCOUNTING.ACCOUNT_MAPPING),

  updateAccountMapping: (mapping: Partial<AccountMapping>): Promise<AccountMapping> =>
    api.put<AccountMapping>(API_ENDPOINTS.ACCOUNTING.ACCOUNT_MAPPING, mapping),

  // ── Round C: opening balances ──
  /** The one organisation-wide entry, whatever its state (`status: "none"` before any). */
  openingBalances: (): Promise<OpeningBalance> =>
    api.get<OpeningBalance>(API_ENDPOINTS.ACCOUNTING.OPENING_BALANCES),

  /** Creates the draft or replaces its lines wholesale. A stale `edit_version` answers 409. */
  saveOpeningBalances: (draft: OpeningBalanceDraft): Promise<OpeningBalance> =>
    api.put<OpeningBalance>(API_ENDPOINTS.ACCOUNTING.OPENING_BALANCES, draft),

  /** Posts the draft once, as one journal. Refused unless balanced. */
  finaliseOpeningBalances: (editVersion: number): Promise<OpeningBalance> =>
    api.post<OpeningBalance>(API_ENDPOINTS.ACCOUNTING.OPENING_BALANCES_FINALISE, {
      edit_version: editVersion,
    }),

  // ── Round C: year-end close ──
  /** One page of closes, newest year first, with `meta.totals.net_surplus`. */
  yearClosesPage: (query: PageParams = {}): Promise<YearClosePage> =>
    api.getRaw<YearClosePage>(API_ENDPOINTS.ACCOUNTING.YEAR_CLOSES, { params: query }),

  /** What closing `year` would post, and why it can't yet. Writes nothing. */
  yearClosePreview: (year: number): Promise<YearClosePreview> =>
    api.get<YearClosePreview>(API_ENDPOINTS.ACCOUNTING.YEAR_CLOSES_PREVIEW, {
      params: { year },
    }),

  closeYear: (year: number): Promise<YearClose> =>
    api.post<YearClose>(API_ENDPOINTS.ACCOUNTING.YEAR_CLOSES, { year }),

  /** The latest closed year only. Reverses its closing entries and reopens its months. */
  reopenYear: (id: number, reason: string): Promise<YearClose> =>
    api.post<YearClose>(API_ENDPOINTS.ACCOUNTING.YEAR_CLOSES_REOPEN(id), { reason }),

  // ── Round C: allowance for credit losses ──
  /** Without `asOf` the server uses today in Manila. Writes nothing. */
  allowancePreview: (asOf?: string): Promise<AllowancePreview> =>
    api.get<AllowancePreview>(API_ENDPOINTS.ACCOUNTING.ALLOWANCE_PREVIEW, {
      params: { as_of: asOf },
    }),

  /**
   * Posts one adjustment per branch. `expectedAdjustment` is the preview's
   * `totals.adjustment` in centavos; if the server's figure moved since, it
   * answers 409 and nothing posts.
   */
  postAllowance: (asOf: string, expectedAdjustment: number): Promise<AllowanceRun> =>
    api.post<AllowanceRun>(API_ENDPOINTS.ACCOUNTING.ALLOWANCE_POSTINGS, {
      as_of: asOf,
      expected_adjustment: expectedAdjustment,
    }),

  /** One page of postings, newest first, with `meta.totals.adjustment`. */
  allowancePostingsPage: (query: PageParams = {}): Promise<AllowancePostingPage> =>
    api.getRaw<AllowancePostingPage>(API_ENDPOINTS.ACCOUNTING.ALLOWANCE_POSTINGS, {
      params: query,
    }),

  // ── Round C: reconciliation actions ──
  // Read whole: the answer carries `created` beside `data`, which `api.post` would drop.
  /** Money out only: records a paid expense from the reconciled account and matches the line. */
  reconcileLineAsExpense: (
    reconciliationId: number,
    lineId: number,
    body: ReconcileLineAsExpenseBody,
  ): Promise<ReconciliationActionResult> =>
    api.rawPost<ReconciliationActionResult>(
      API_ENDPOINTS.ACCOUNTING.RECONCILIATION_LINE_EXPENSE(reconciliationId, lineId),
      body,
    ),

  reconcileLineAsTransfer: (
    reconciliationId: number,
    lineId: number,
    body: ReconcileLineAsTransferBody,
  ): Promise<ReconciliationActionResult> =>
    api.rawPost<ReconciliationActionResult>(
      API_ENDPOINTS.ACCOUNTING.RECONCILIATION_LINE_TRANSFER(reconciliationId, lineId),
      body,
    ),

  /** Posts a suspense journal at once and matches the line to it. */
  reconcileLineToSuspense: (
    reconciliationId: number,
    lineId: number,
    body: ReconcileLineToSuspenseBody = {},
  ): Promise<ReconciliationActionResult> =>
    api.rawPost<ReconciliationActionResult>(
      API_ENDPOINTS.ACCOUNTING.RECONCILIATION_LINE_SUSPENSE(reconciliationId, lineId),
      body,
    ),

  // ── Round C: attachments ──
  journalAttachments: (journalId: number): Promise<AccountingAttachment[]> =>
    api.get<AccountingAttachment[]>(API_ENDPOINTS.ACCOUNTING.JOURNAL_ATTACHMENTS(journalId)),

  /** Multipart: `file` (10 MB; jpg, jpeg, png, pdf, doc, docx) and an optional `label`. */
  uploadJournalAttachment: (
    journalId: number,
    file: File,
    label?: string,
  ): Promise<AccountingAttachment> =>
    api.upload<AccountingAttachment>(
      API_ENDPOINTS.ACCOUNTING.JOURNAL_ATTACHMENTS(journalId),
      attachmentFormData(file, label),
    ),

  /** A posted or reversed journal needs `accounting:settings` and a `reason`. */
  removeJournalAttachment: (
    journalId: number,
    attachmentId: number,
    reason?: string,
  ): Promise<{ message: string }> =>
    api.rawDelete<{ message: string }>(
      API_ENDPOINTS.ACCOUNTING.JOURNAL_ATTACHMENT(journalId, attachmentId),
      { data: reason === undefined ? undefined : { reason } },
    ),

  expenseAttachments: (expenseId: number): Promise<AccountingAttachment[]> =>
    api.get<AccountingAttachment[]>(API_ENDPOINTS.ACCOUNTING.EXPENSE_ATTACHMENTS(expenseId)),

  uploadExpenseAttachment: (
    expenseId: number,
    file: File,
    label?: string,
  ): Promise<AccountingAttachment> =>
    api.upload<AccountingAttachment>(
      API_ENDPOINTS.ACCOUNTING.EXPENSE_ATTACHMENTS(expenseId),
      attachmentFormData(file, label),
    ),

  /** Any expense's attachment needs `accounting:settings` and a `reason`. */
  removeExpenseAttachment: (
    expenseId: number,
    attachmentId: number,
    reason?: string,
  ): Promise<{ message: string }> =>
    api.rawDelete<{ message: string }>(
      API_ENDPOINTS.ACCOUNTING.EXPENSE_ATTACHMENT(expenseId, attachmentId),
      { data: reason === undefined ? undefined : { reason } },
    ),
};

/** The attachment upload body: the file, and the label only when there is one. */
function attachmentFormData(file: File, label?: string): FormData {
  const formData = new FormData();
  formData.append("file", file);
  if (label) formData.append("label", label);
  return formData;
}
