/**
 * Savings & Deposits API client (staff side).
 *
 * None of these endpoints exist yet — `docs/SAVINGS_BACKEND_HANDOFF.md` is the
 * contract. A 404/501 renders as "Not connected yet" through `useApiResource`.
 * No fixtures: a balance that is invented is worse than none.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  CloseSavingsAccountInput,
  OpenSavingsAccountInput,
  PaginatedResponse,
  SavingsAccount,
  SavingsAccountsResponse,
  SavingsProduct,
  SavingsProductInput,
  SavingsTransaction,
  SavingsTransactionInput,
} from "@/types";

const E = API_ENDPOINTS.SAVINGS;

export const savingsService = {
  // ── Products ──

  /** Every product, active and inactive. A short list, so not paged. */
  products: () => api.get<SavingsProduct[]>(E.PRODUCTS),
  createProduct: (data: SavingsProductInput) => api.post<SavingsProduct>(E.PRODUCTS, data),
  updateProduct: (id: number, data: SavingsProductInput) =>
    api.put<SavingsProduct>(E.PRODUCT(id), data),
  /** 422 while the product still has accounts; deactivate it instead. */
  deleteProduct: (id: number) => api.delete<void>(E.PRODUCT(id)),

  // ── Accounts ──

  /**
   * One page of accounts. `getRaw` so `meta` (paging, `stats`, `totals`)
   * survives. Params: `page`, `per_page` (≤ 100), `search` (account number,
   * member name or code), `status`, `product_id`, `branch_id`, `borrower_id`.
   */
  accounts: (params?: Record<string, unknown>) =>
    api.getRaw<SavingsAccountsResponse>(E.ACCOUNTS, { params }),
  account: (id: number) => api.get<SavingsAccount>(E.ACCOUNT(id)),
  openAccount: (data: OpenSavingsAccountInput) => api.post<SavingsAccount>(E.ACCOUNTS, data),
  closeAccount: (id: number, data: CloseSavingsAccountInput) =>
    api.post<SavingsAccount>(E.CLOSE(id), data),

  // ── Transactions ──

  /** One page of an account's ledger, newest first. Params: `page`, `per_page`, `date_from`, `date_to`, `type`. */
  transactions: (id: number, params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<SavingsTransaction>>(E.TRANSACTIONS(id), { params }),
  deposit: (id: number, data: SavingsTransactionInput) =>
    api.post<SavingsTransaction>(E.DEPOSITS(id), data),
  withdraw: (id: number, data: SavingsTransactionInput) =>
    api.post<SavingsTransaction>(E.WITHDRAWALS(id), data),
};
