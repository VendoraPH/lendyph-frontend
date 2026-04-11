import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  Repayment,
  CreateRepaymentData,
  VoidRepaymentData,
  PaginatedResponse,
} from "@/types";

export const repaymentService = {
  list: (loanId: number, params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Repayment>>(API_ENDPOINTS.REPAYMENTS.LIST(loanId), { params }),

  listAll: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Repayment>>(API_ENDPOINTS.REPAYMENTS.LIST_ALL, { params }),

  create: (loanId: number, data: CreateRepaymentData) =>
    api.post<Repayment>(API_ENDPOINTS.REPAYMENTS.CREATE(loanId), data),

  detail: (id: number) =>
    api.get<Repayment>(API_ENDPOINTS.REPAYMENTS.DETAIL(id)),

  void: (id: number, data: VoidRepaymentData) =>
    api.patch<Repayment>(API_ENDPOINTS.REPAYMENTS.VOID(id), data),
};
