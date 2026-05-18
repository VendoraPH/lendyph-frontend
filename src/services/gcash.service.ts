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
  PaginatedResponse,
} from "@/types";

export const gcashService = {
  listTransactions: (params?: GCashListFilters) =>
    api.get<PaginatedResponse<GCashTransaction>>(
      API_ENDPOINTS.GCASH.TRANSACTIONS_LIST,
      { params },
    ),

  createTransaction: (data: CreateGCashTransactionData) =>
    api.post<GCashTransaction>(API_ENDPOINTS.GCASH.TRANSACTIONS_CREATE, data),

  markPaid: (id: number) =>
    api.patch<GCashTransaction>(API_ENDPOINTS.GCASH.TRANSACTIONS_MARK_PAID(id)),

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
