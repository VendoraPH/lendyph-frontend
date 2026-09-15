import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
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
