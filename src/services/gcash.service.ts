import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type {
  GCashTransaction,
  GCashTier,
  GCashTierInput,
  GCashIncomeReport,
  GCashPendingItem,
  CreateGCashTransactionData,
  GCashListFilters,
  GCashNonMember,
  GCashNonMemberInput,
  GCashNonMemberFilters,
  PaginatedResponse,
} from "@/types";

export const gcashService = {
  // Backend returns a raw Laravel paginator ({data, links, meta}) for this
  // endpoint with no {success, data} envelope, so it must bypass api.get's
  // unwrap (which would otherwise strip meta/links and return a bare array).
  listTransactions: (params?: GCashListFilters) =>
    api.getRaw<PaginatedResponse<GCashTransaction>>(
      API_ENDPOINTS.GCASH.TRANSACTIONS_LIST,
      { params },
    ),

  createTransaction: (data: CreateGCashTransactionData) =>
    api.post<GCashTransaction>(API_ENDPOINTS.GCASH.TRANSACTIONS_CREATE, data),

  markPaid: (id: number) =>
    api.patch<GCashTransaction>(API_ENDPOINTS.GCASH.TRANSACTIONS_MARK_PAID(id)),

  // Same raw-paginator shape as the transactions list above, for the same
  // reason: api.get's unwrap would drop meta and break pagination.
  listNonMembers: (params?: GCashNonMemberFilters) =>
    api.getRaw<PaginatedResponse<GCashNonMember>>(
      API_ENDPOINTS.GCASH.NON_MEMBERS_LIST,
      { params },
    ),

  /**
   * Every walk-in, across as many pages as it takes — for the party pickers,
   * which need the whole list in hand rather than a page of it.
   *
   * `GCashNonMemberController::index()` paginates with
   * `min((int) per_page, 100)` exactly like the borrower and loan controllers,
   * and is just as quiet about it. A picker that asks for one big page shows
   * the first 100 walk-ins and looks finished; the teller reads the missing
   * ones as "that customer was never registered" and re-adds them, which is
   * how the same person ends up in the list twice.
   *
   * Returns a `DrainResult`, NOT a row array, for the reason spelled out on
   * `borrowerService.listAll`: `truncated` is part of the answer and the caller
   * has to render it. `page` and `per_page` are set by the drain — passing them
   * in `params` has no effect.
   */
  listAllNonMembers: (
    params?: Omit<GCashNonMemberFilters, "page" | "per_page">,
  ): Promise<DrainResult<GCashNonMember>> =>
    fetchAllPages<GCashNonMember>(({ page, per_page }) =>
      gcashService.listNonMembers({ ...params, page, per_page }),
    ),

  createNonMember: (data: GCashNonMemberInput) =>
    api.post<GCashNonMember>(API_ENDPOINTS.GCASH.NON_MEMBERS_CREATE, data),

  updateNonMember: (id: number, data: GCashNonMemberInput) =>
    api.put<GCashNonMember>(API_ENDPOINTS.GCASH.NON_MEMBERS_UPDATE(id), data),

  deleteNonMember: (id: number) =>
    api.delete<void>(API_ENDPOINTS.GCASH.NON_MEMBERS_DELETE(id)),

  listTiers: () => api.get<GCashTier[]>(API_ENDPOINTS.GCASH.TIERS_LIST),

  upsertTiers: (tiers: GCashTierInput[]) =>
    api.put<GCashTier[]>(API_ENDPOINTS.GCASH.TIERS_UPSERT, { tiers }),

  incomeReport: (start_date: string, end_date: string) =>
    api.get<GCashIncomeReport>(API_ENDPOINTS.GCASH.REPORTS_INCOME, {
      params: { start_date, end_date },
    }),

  pendingList: () =>
    api.get<GCashPendingItem[]>(API_ENDPOINTS.GCASH.REPORTS_PENDING),
};
