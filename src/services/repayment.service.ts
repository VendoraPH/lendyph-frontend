import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  Repayment,
  CreateRepaymentData,
  VoidRepaymentData,
  PaginatedResponse,
} from "@/types";

export interface RepaymentPreviewAllocation {
  schedule_id?: number;
  period?: number;
  due_date?: string;
  principal?: number;
  interest?: number;
  penalty?: number;
  amount_applied?: number;
  remaining_balance?: number;
}

export interface RepaymentPreview {
  total_paid?: number;
  total_principal?: number;
  total_interest?: number;
  total_penalty?: number;
  excess?: number;
  allocations?: RepaymentPreviewAllocation[];
  [key: string]: unknown;
}

export const repaymentService = {
  list: (loanId: number, params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Repayment>>(API_ENDPOINTS.REPAYMENTS.LIST(loanId), { params }),

  listAll: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Repayment>>(API_ENDPOINTS.REPAYMENTS.LIST_ALL, { params }),

  create: (loanId: number, data: CreateRepaymentData) =>
    api.post<Repayment>(API_ENDPOINTS.REPAYMENTS.CREATE(loanId), data),

  preview: (
    loanId: number,
    data: { amount_paid: number; payment_date: string }
  ) => api.post<RepaymentPreview>(API_ENDPOINTS.REPAYMENTS.PREVIEW(loanId), data),

  detail: (id: number) =>
    api.get<Repayment>(API_ENDPOINTS.REPAYMENTS.DETAIL(id)),

  void: (id: number, data: VoidRepaymentData) =>
    api.patch<Repayment>(API_ENDPOINTS.REPAYMENTS.VOID(id), data),
};
