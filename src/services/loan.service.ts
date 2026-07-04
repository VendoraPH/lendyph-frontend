import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Loan, LoanSchedule, PaginatedResponse, AutoPayToggleData, AutoPaySettings } from "@/types";
import type { ApiAmortizationSchedule } from "@/lib/amortization";

export type ReleaseLoanPayload = {
  insurance_premium_percentage?: number;
  insurance_premium_amount?: number;
  insurance_payment_type?: "full" | "partial";
  insurance_partial_amount?: number;
  insurance_remaining_balance?: number;
};

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

  release: (id: number, payload?: ReleaseLoanPayload) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id), payload),

  submit: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.SUBMIT(id)),

  void: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.VOID(id)),

  amortizationPreview: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.AMORTIZATION_PREVIEW(id)),

  amortizationSchedule: (id: number) =>
    api.get<ApiAmortizationSchedule>(API_ENDPOINTS.LOANS.AMORTIZATION_SCHEDULE(id)),

  /** Loan balance summary (replaces the old /schedule endpoint) */
  summary: (id: number) =>
    api.get(API_ENDPOINTS.LOANS.SUMMARY(id)),

  /** Alias — maps to amortization-schedule for backward compat */
  schedule: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.AMORTIZATION_SCHEDULE(id)),

  extend: (id: number, data?: { remarks?: string }) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.EXTEND(id), data),

  restructure: (id: number, data: Record<string, unknown>) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.RESTRUCTURE(id), data),

  toggleAutoPay: (id: number, data: AutoPayToggleData) =>
    api.patch<AutoPaySettings>(API_ENDPOINTS.LOANS.TOGGLE_AUTO_PAY(id), data),
};
