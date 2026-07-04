import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { LoanAdjustment, CreateLoanAdjustmentData } from "@/types";

export const loanAdjustmentService = {
  list: (loanId: number) =>
    api.get<LoanAdjustment[]>(API_ENDPOINTS.LOAN_ADJUSTMENTS.LIST(loanId)),

  create: (loanId: number, data: CreateLoanAdjustmentData) =>
    api.post<LoanAdjustment>(API_ENDPOINTS.LOAN_ADJUSTMENTS.CREATE(loanId), data),

  detail: (id: number) =>
    api.get<LoanAdjustment>(API_ENDPOINTS.LOAN_ADJUSTMENTS.DETAIL(id)),

  approve: (id: number, data?: { remarks?: string }) =>
    api.patch<LoanAdjustment>(API_ENDPOINTS.LOAN_ADJUSTMENTS.APPROVE(id), data),

  reject: (id: number, data?: { remarks?: string }) =>
    api.patch<LoanAdjustment>(API_ENDPOINTS.LOAN_ADJUSTMENTS.REJECT(id), data),

  apply: (id: number) =>
    api.patch<LoanAdjustment>(API_ENDPOINTS.LOAN_ADJUSTMENTS.APPLY(id)),
};
