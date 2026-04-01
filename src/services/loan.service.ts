import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Loan, LoanSchedule, PaginatedResponse } from "@/types";
import type { ApiAmortizationSchedule } from "@/lib/amortization";

export const loanService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Loan>>(API_ENDPOINTS.LOANS.LIST, { params }),

  detail: (id: number) =>
    api.get<Loan>(API_ENDPOINTS.LOANS.DETAIL(id)),

  create: (data: Partial<Loan>) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.CREATE, data),

  update: (id: number, data: Partial<Loan>) =>
    api.put<Loan>(API_ENDPOINTS.LOANS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.LOANS.DELETE(id)),

  approve: (id: number, data?: { approval_remarks?: string }) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.APPROVE(id), data),

  reject: (id: number, data?: { approval_remarks?: string }) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.REJECT(id), data),

  release: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id)),

  schedule: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.SCHEDULE(id)),

  restructure: (id: number, data: Partial<Loan>) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.RESTRUCTURE(id), data),

  amortizationPreview: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.AMORTIZATION_PREVIEW(id)),

  submit: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.SUBMIT(id)),

  void: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.VOID(id)),

  amortizationSchedule: (id: number) =>
    api.get<ApiAmortizationSchedule>(API_ENDPOINTS.LOANS.AMORTIZATION_SCHEDULE(id)),
};
