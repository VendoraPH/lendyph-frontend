import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Loan, LoanSchedule, PaginatedResponse } from "@/types";

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

  approve: (id: number) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.APPROVE(id)),

  reject: (id: number, reason?: string) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.REJECT(id), { reason }),

  release: (id: number) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.RELEASE(id)),

  schedule: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.SCHEDULE(id)),

  restructure: (id: number, data: Partial<Loan>) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.RESTRUCTURE(id), data),
};
