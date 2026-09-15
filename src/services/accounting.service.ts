/**
 * Accounting API client.
 *
 * NONE of these endpoints exist yet — see the note on `API_ENDPOINTS.ACCOUNTING`.
 * They are typed and wired now so that the day the backend lands, the only
 * thing that changes is the paths file, not thirteen call sites.
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
  AccountMapping,
  AccountingBook,
  AccountingDashboard,
  AccountingPeriod,
  Aging,
  BookKind,
  CashFlowStatement,
  EquityChanges,
  Expense,
  JournalEntry,
  JournalEntryDraft,
  LedgerEntry,
  Reconciliation,
  TrialBalance,
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

export const accountingService = {
  // ── Dashboard ──
  dashboard: (asOf: string, branchId?: number): Promise<AccountingDashboard> =>
    api.get<AccountingDashboard>(API_ENDPOINTS.ACCOUNTING.DASHBOARD, {
      params: { as_of: asOf, branch_id: branchId },
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

  createAccount: (data: Partial<Account>): Promise<Account> =>
    api.post<Account>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_CREATE, data),

  updateAccount: (id: number, data: Partial<Account>): Promise<Account> =>
    api.put<Account>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_UPDATE(id), data),

  deleteAccount: (id: number): Promise<void> =>
    api.delete(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_DELETE(id)),

  /** Seed a fresh organisation with the default chart. One-time, admin-only. */
  seedAccounts: (): Promise<Account[]> =>
    api.post<Account[]>(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_SEED, {}),

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

  getJournal: (id: number): Promise<JournalEntry> =>
    api.get<JournalEntry>(API_ENDPOINTS.ACCOUNTING.JOURNALS_DETAIL(id)),

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

  trialBalance: (asOf: string, branchId?: number): Promise<TrialBalance> =>
    api.get<TrialBalance>(API_ENDPOINTS.ACCOUNTING.TRIAL_BALANCE, {
      params: { as_of: asOf, branch_id: branchId },
    }),

  /**
   * Balance sheet and income statement are NOT here. They are regroupings of
   * the trial balance and are built from it by `@/lib/accounting/statements`,
   * so there is exactly one place a figure can come from.
   */
  cashFlow: (query: PeriodQuery): Promise<CashFlowStatement> =>
    api.get<CashFlowStatement>(API_ENDPOINTS.ACCOUNTING.CASH_FLOW, { params: query }),

  equityChanges: (query: PeriodQuery): Promise<EquityChanges> =>
    api.get<EquityChanges>(API_ENDPOINTS.ACCOUNTING.EQUITY_CHANGES, { params: query }),

  book: (kind: BookKind, query: PeriodQuery): Promise<AccountingBook> =>
    api.get<AccountingBook>(API_ENDPOINTS.ACCOUNTING.BOOKS[kind], { params: query }),

  receivableAging: (asOf: string, branchId?: number): Promise<Aging> =>
    api.get<Aging>(API_ENDPOINTS.ACCOUNTING.RECEIVABLE_AGING, {
      params: { as_of: asOf, branch_id: branchId },
    }),

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

  createExpense: (data: Partial<Expense>): Promise<Expense> =>
    api.post<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_CREATE, data),

  payExpense: (id: number, data: { date: string; amount: number; account_id: number }) =>
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
};
