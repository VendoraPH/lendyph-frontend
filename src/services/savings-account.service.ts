import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import type { PaginatedResponse } from "@/types";
import type {
  OpenSavingsAccountPayload,
  OpenSavingsAccountResult,
  SavingsAccount,
  SavingsAccountStatus,
  SavingsAuditEntry,
  SavingsClosingQuote,
  SavingsStatusChange,
  SavingsTransaction,
  SavingsTransactionTotals,
} from "@/types/savings";

/** A page of an account's transactions with the server's period totals. */
export type SavingsTransactionPage = PaginatedResponse<SavingsTransaction> & {
  meta: PaginatedResponse<SavingsTransaction>["meta"] & {
    totals?: SavingsTransactionTotals;
    opening_balance?: string | number | null;
    closing_balance?: string | number | null;
  };
};

/**
 * Savings accounts: inquiry, opening, maintenance. Not built on the backend
 * yet — docs/SAVINGS_BACKEND_HANDOFF.md is the contract.
 */
export const savingsAccountService = {
  /**
   * One page of accounts, `getRaw` so `meta.stats` (per-status counts) and
   * paging survive. Params: `page`, `per_page` (≤ 100), `search` (account
   * number or member), `borrower_id`, `savings_product_id`, `branch_id`,
   * `status`, `opened_from`, `opened_to`.
   */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<SavingsAccount>>(API_ENDPOINTS.SAVINGS.ACCOUNTS, { params }),

  listAll: (params: Record<string, unknown> = {}): Promise<DrainResult<SavingsAccount>> =>
    fetchAllPages<SavingsAccount>(({ page, per_page }) =>
      savingsAccountService.list({ ...params, page, per_page }),
    ),

  get: (id: number) => api.get<SavingsAccount>(API_ENDPOINTS.SAVINGS.ACCOUNT(id)),

  /** The number the next account would get. A preview: the server assigns on create. */
  nextNumber: (params: { branch_id?: number | null } = {}) =>
    api.get<{ account_number: string }>(API_ENDPOINTS.SAVINGS.ACCOUNT_NEXT_NUMBER, { params }),

  /** Opens the account and posts the initial deposit in one transaction. */
  open: (data: OpenSavingsAccountPayload, key: string | null) =>
    api.post<OpenSavingsAccountResult>(API_ENDPOINTS.SAVINGS.ACCOUNTS, data, idempotencyHeaders(key)),

  /** Remarks only; balances and status never change through this. */
  update: (id: number, data: { remarks: string | null }) =>
    api.put<SavingsAccount>(API_ENDPOINTS.SAVINGS.ACCOUNT(id), data),

  /** Freeze, unfreeze, reactivate (dormant → active). A reason is required. */
  setStatus: (id: number, status: SavingsAccountStatus, reason: string) =>
    api.patch<SavingsAccount>(API_ENDPOINTS.SAVINGS.ACCOUNT_STATUS(id), { status, reason }),

  closingQuote: (id: number) =>
    api.get<SavingsClosingQuote>(API_ENDPOINTS.SAVINGS.ACCOUNT_CLOSING_QUOTE(id)),

  close: (id: number, data: { reason: string; payment_method: string }, key: string | null) =>
    api.post<SavingsAccount>(API_ENDPOINTS.SAVINGS.ACCOUNT_CLOSE(id), data, idempotencyHeaders(key)),

  /**
   * One page of the account's transactions, each with the server's running
   * balance; `meta.totals` and opening/closing balance cover the whole range.
   * Params: `page`, `per_page`, `date_from`, `date_to`, `type`.
   */
  transactions: (id: number, params?: Record<string, unknown>) =>
    api.getRaw<SavingsTransactionPage>(API_ENDPOINTS.SAVINGS.ACCOUNT_TRANSACTIONS(id), { params }),

  allTransactions: (id: number, params: Record<string, unknown> = {}) =>
    fetchAllPages<SavingsTransaction>(({ page, per_page }) =>
      savingsAccountService.transactions(id, { ...params, page, per_page }),
    ),

  statusHistory: (id: number) =>
    api.get<SavingsStatusChange[]>(API_ENDPOINTS.SAVINGS.ACCOUNT_STATUS_HISTORY(id)),

  audit: (id: number) => api.get<SavingsAuditEntry[]>(API_ENDPOINTS.SAVINGS.ACCOUNT_AUDIT(id)),
};
