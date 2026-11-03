import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages } from "@/lib/paginate";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import type {
  SavingsDepositPayload,
  SavingsTransaction,
  SavingsTransferPayload,
  SavingsTransferResult,
  SavingsWithdrawalPayload,
  SavingsDashboard,
} from "@/types/savings";
import type { SavingsTransactionPage } from "./savings-account.service";

/**
 * Money movement: deposits, withdrawals, transfers, reversals. Every POST
 * that posts money carries the form's `Idempotency-Key`, so a retry after a
 * lost response returns the first posting instead of making a second one.
 * Not built on the backend yet — docs/SAVINGS_BACKEND_HANDOFF.md.
 */
export const savingsTransactionService = {
  deposit: (data: SavingsDepositPayload, key: string | null) =>
    api.post<SavingsTransaction>(API_ENDPOINTS.SAVINGS.DEPOSITS, data, idempotencyHeaders(key)),

  withdraw: (data: SavingsWithdrawalPayload, key: string | null) =>
    api.post<SavingsTransaction>(API_ENDPOINTS.SAVINGS.WITHDRAWALS, data, idempotencyHeaders(key)),

  /** Both legs post or neither does: one server transaction. */
  transfer: (data: SavingsTransferPayload, key: string | null) =>
    api.post<SavingsTransferResult>(API_ENDPOINTS.SAVINGS.TRANSFERS, data, idempotencyHeaders(key)),

  /**
   * One page of every account's transactions, `getRaw` so `meta.totals`
   * survives. Params: `page`, `per_page`, `search`, `account_id`,
   * `borrower_id`, `type`, `status`, `branch_id`, `date_from`, `date_to`.
   */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<SavingsTransactionPage>(API_ENDPOINTS.SAVINGS.TRANSACTIONS, { params }),

  listAll: (params: Record<string, unknown> = {}) =>
    fetchAllPages<SavingsTransaction>(({ page, per_page }) =>
      savingsTransactionService.list({ ...params, page, per_page }),
    ),

  /** One transaction with previous/new balance — the receipt's payload. */
  get: (id: number) => api.get<SavingsTransaction>(API_ENDPOINTS.SAVINGS.TRANSACTION(id)),

  /**
   * Ask to reverse a posted transaction. When reversal approval is on the
   * server answers with the request pending; otherwise with the reversal.
   */
  reverse: (id: number, reason: string, key: string | null) =>
    api.post<SavingsTransaction>(
      API_ENDPOINTS.SAVINGS.TRANSACTION_REVERSE(id),
      { reason },
      idempotencyHeaders(key),
    ),

  /** The server refuses (403) an approver who requested the reversal. */
  approveReversal: (reversalId: number) =>
    api.post<SavingsTransaction>(API_ENDPOINTS.SAVINGS.REVERSAL_APPROVE(reversalId)),

  rejectReversal: (reversalId: number, reason: string) =>
    api.post<SavingsTransaction>(API_ENDPOINTS.SAVINGS.REVERSAL_REJECT(reversalId), { reason }),

  dashboard: () => api.get<SavingsDashboard>(API_ENDPOINTS.SAVINGS.DASHBOARD),
};
