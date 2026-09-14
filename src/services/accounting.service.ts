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

/** Unwrap `{ data: [...] }` or a bare array — the API does both. */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: T[] }).data)) {
    return (res as { data: T[] }).data;
  }
  return [];
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
  listAccounts: async (): Promise<Account[]> =>
    unwrapList<Account>(await api.get(API_ENDPOINTS.ACCOUNTING.ACCOUNTS_LIST)),

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
  listJournals: async (query: JournalQuery = {}): Promise<JournalEntry[]> =>
    unwrapList<JournalEntry>(
      await api.get(API_ENDPOINTS.ACCOUNTING.JOURNALS_LIST, { params: query }),
    ),

  getJournal: (id: number): Promise<JournalEntry> =>
    api.get<JournalEntry>(API_ENDPOINTS.ACCOUNTING.JOURNALS_DETAIL(id)),

  createJournal: (draft: JournalEntryDraft): Promise<JournalEntry> =>
    api.post<JournalEntry>(API_ENDPOINTS.ACCOUNTING.JOURNALS_CREATE, draft),

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
  generalLedger: async (query: LedgerQuery): Promise<LedgerEntry[]> =>
    unwrapList<LedgerEntry>(
      await api.get(API_ENDPOINTS.ACCOUNTING.GENERAL_LEDGER, { params: query }),
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
  listExpenses: async (): Promise<Expense[]> =>
    unwrapList<Expense>(await api.get(API_ENDPOINTS.ACCOUNTING.EXPENSES_LIST)),

  createExpense: (data: Partial<Expense>): Promise<Expense> =>
    api.post<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_CREATE, data),

  payExpense: (id: number, data: { date: string; amount: number; account_id: number }) =>
    api.post<Expense>(API_ENDPOINTS.ACCOUNTING.EXPENSES_PAY(id), data),

  // ── Cash and bank ──
  listCashAccounts: async (): Promise<Account[]> =>
    unwrapList<Account>(await api.get(API_ENDPOINTS.ACCOUNTING.CASH_ACCOUNTS_LIST)),

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
  listReconciliations: async (): Promise<Reconciliation[]> =>
    unwrapList<Reconciliation>(
      await api.get(API_ENDPOINTS.ACCOUNTING.RECONCILIATIONS_LIST),
    ),

  // ── Periods ──
  listPeriods: async (): Promise<AccountingPeriod[]> =>
    unwrapList<AccountingPeriod>(await api.get(API_ENDPOINTS.ACCOUNTING.PERIODS_LIST)),

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
