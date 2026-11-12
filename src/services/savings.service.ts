/**
 * Savings & Deposits API client (staff side): settings, products and rates,
 * accounts, the teller's money posts, holds and the transaction register.
 * Contract: lendyph-backend's savings design §2.
 *
 * Every money post carries the form's `Idempotency-Key` (from
 * `useSubmitGuard`), so a retry after a lost response returns the first
 * posting instead of a second one. Money is sent and read as two-decimal
 * text; the browser never works a figure out.
 */

import axiosClient from "@/lib/axios-client";
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages } from "@/lib/paginate";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import { readMoneyPost, type MoneyPostResult } from "@/lib/savings/money-post";
import type {
  CloseSavingsAccountInput,
  OpenSavingsAccountInput,
  PaginatedResponse,
  PlaceSavingsHoldInput,
  PrepareBooksResult,
  ReleaseSavingsHoldInput,
  SavingsAccount,
  SavingsAccountsResponse,
  SavingsClosingQuote,
  SavingsHold,
  SavingsOpeningCheck,
  SavingsProduct,
  SavingsProductCreateInput,
  SavingsProductRate,
  SavingsProductUpdateInput,
  SavingsRateInput,
  SavingsSettings,
  SavingsSettingsInput,
  SavingsStatusInput,
  SavingsTaxRule,
  SavingsTaxRuleInput,
  SavingsTierRateInput,
  SavingsTransaction,
  SavingsTransactionInput,
  SavingsTransactionsResponse,
  SavingsTransferInput,
  SavingsTransferResult,
} from "@/types";

const E = API_ENDPOINTS.SAVINGS;

/**
 * POST a money movement with its idempotency key and read 201 (posted) or
 * 202 (`{approval}`, sent for approval) from the HTTP status.
 */
export async function postMoney<T>(url: string, body: unknown, key: string | null): Promise<MoneyPostResult<T>> {
  const response = await axiosClient.post<{ success: boolean; data: unknown }>(url, body, idempotencyHeaders(key));
  return readMoneyPost<T>(response.status, response.data?.data);
}

export const savingsService = {
  // ── Settings and tax rules ──

  settings: () => api.get<SavingsSettings>(E.SETTINGS),
  updateSettings: (data: SavingsSettingsInput) => api.put<SavingsSettings>(E.SETTINGS, data),
  /**
   * Adds any missing savings accounts and posting roles to the chart
   * (savings:settings plus branches:view_all). 422 on `books` with no chart
   * yet; 409 when pressed twice at once.
   */
  prepareBooks: () => api.post<PrepareBooksResult>(E.PREPARE_BOOKS),
  /** Append-only; `effective_from` on or after today. */
  addTaxRule: (data: SavingsTaxRuleInput) => api.post<SavingsTaxRule>(E.TAX_RULES, data),

  // ── Products and rates ──

  /** Every product, active and inactive. A short list, so not paged. */
  products: () => api.get<SavingsProduct[]>(E.PRODUCTS),
  createProduct: (data: SavingsProductCreateInput) => api.post<SavingsProduct>(E.PRODUCTS, data),
  /** Activation answers 422 in words when the books aren't ready. */
  updateProduct: (id: number, data: Partial<SavingsProductUpdateInput>) =>
    api.put<SavingsProduct>(E.PRODUCT(id), data),
  /** 422 once any account or time deposit exists (`can_delete` false). */
  deleteProduct: (id: number) => api.delete<void>(E.PRODUCT(id)),
  /** The product's rate history, newest first. */
  rates: (id: number) => api.get<SavingsProductRate[]>(E.PRODUCT_RATES(id)),
  /** Append-only: a new row, `effective_from` on or after today. */
  addRate: (id: number, data: SavingsRateInput) => api.post<SavingsProductRate>(E.PRODUCT_RATES(id), data),
  /**
   * A ladder for one date (regular products; gap round S2), base tier first.
   * It replaces that date's whole ladder; answers the ladder now in force.
   */
  addRateTiers: (id: number, data: SavingsTierRateInput) =>
    api.post<SavingsProductRate[]>(E.PRODUCT_RATES(id), data),

  // ── Accounts ──

  /**
   * One page of accounts, `getRaw` so `meta` (`stats`, `totals`) survives.
   * Params: `page`, `per_page` (≤ 100), `search`, `status`, `product_id`,
   * `branch_id`, `borrower_id`.
   */
  accounts: (params?: Record<string, unknown>) =>
    api.getRaw<SavingsAccountsResponse>(E.ACCOUNTS, { params }),
  account: (id: number) => api.get<SavingsAccount>(E.ACCOUNT(id)),
  /**
   * The member check before opening (gap round S1): standing, loans, share
   * capital, accounts and the products the member may open. 404 for a member
   * outside the caller's branches.
   */
  openingCheck: (borrowerId: number) =>
    api.get<SavingsOpeningCheck>(E.OPENING_CHECK, { params: { borrower_id: borrowerId } }),
  openAccount: (data: OpenSavingsAccountInput, key: string | null) =>
    api.post<SavingsAccount>(E.ACCOUNTS, data, idempotencyHeaders(key)),

  /** One page of an account's ledger. Params: `page`, `per_page`, `date_from`, `date_to`, `type`. */
  accountTransactions: (id: number, params?: Record<string, unknown>) =>
    api.getRaw<SavingsTransactionsResponse>(E.ACCOUNT_TRANSACTIONS(id), { params }),
  /** Every ledger line, for the passbook, drained 100 a page. */
  allAccountTransactions: (id: number, params: Record<string, unknown> = {}) =>
    fetchAllPages<SavingsTransaction>(({ page, per_page }) =>
      savingsService.accountTransactions(id, { ...params, page, per_page }),
    ),

  // ── Money posts ──

  /** 201. A deposit reactivates a dormant account. */
  deposit: (id: number, data: SavingsTransactionInput, key: string | null) =>
    postMoney<SavingsTransaction>(E.DEPOSITS(id), data, key),
  /** 201, or 202 with `{approval}` above the first tier. */
  withdraw: (id: number, data: SavingsTransactionInput, key: string | null) =>
    postMoney<SavingsTransaction>(E.WITHDRAWALS(id), data, key),
  /** Same member, same branch. 201 with both legs; no approval tier. */
  transfer: (id: number, data: SavingsTransferInput, key: string | null) =>
    postMoney<SavingsTransferResult>(E.TRANSFERS(id), data, key),
  /** What closing on `date` (today by default; today or yesterday) credits and pays. */
  closingQuote: (id: number, date?: string) =>
    api.get<SavingsClosingQuote>(E.CLOSING_QUOTE(id), { params: date ? { date } : undefined }),
  /** 201 with the closed account, or 202 with `{approval}`. */
  close: (id: number, data: CloseSavingsAccountInput, key: string | null) =>
    postMoney<SavingsAccount>(E.CLOSE(id), data, key),
  /** Freeze, unfreeze or reactivate, with a reason. */
  setStatus: (id: number, data: SavingsStatusInput) => api.post<SavingsAccount>(E.STATUS(id), data),

  // ── Holds ──

  /** Every hold on the account, active first. A short list, so not paged. */
  holds: (id: number) => api.get<SavingsHold[]>(E.HOLDS(id)),
  /** Needs an `Idempotency-Key` (422 without one). */
  placeHold: (id: number, data: PlaceSavingsHoldInput, key: string | null) =>
    api.post<SavingsHold>(E.HOLDS(id), data, idempotencyHeaders(key)),
  releaseHold: (holdId: number, data: ReleaseSavingsHoldInput) =>
    api.post<SavingsHold>(E.HOLD_RELEASE(holdId), data),

  // ── The register and reversals ──

  /**
   * One page of every account's transactions, `getRaw` so `meta` survives.
   * Params: `page`, `per_page`, `search`, `type`, `branch_id`, `date_from`, `date_to`.
   */
  transactions: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<SavingsTransaction>>(E.TRANSACTIONS, { params }),
  transaction: (id: number) => api.get<SavingsTransaction>(E.TRANSACTION(id)),
  /** Always 202 with the approval: a reversal posts only once someone else approves it. */
  requestReversal: (id: number, reason: string, key: string | null) =>
    postMoney<SavingsTransaction>(E.TRANSACTION_REVERSE(id), { reason }, key),
};
