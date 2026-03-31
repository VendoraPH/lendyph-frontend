import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Borrower, Loan, Payment, PaginatedResponse } from "@/types";

export const borrowerService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Borrower>>(API_ENDPOINTS.BORROWERS.LIST, {
      params,
    }),

  detail: (id: number) =>
    api.get<Borrower>(API_ENDPOINTS.BORROWERS.DETAIL(id)),

  create: (data: Partial<Borrower>) =>
    api.post<Borrower>(API_ENDPOINTS.BORROWERS.CREATE, data),

  update: (id: number, data: Partial<Borrower>) =>
    api.put<Borrower>(API_ENDPOINTS.BORROWERS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.BORROWERS.DELETE(id)),

  loans: (id: number) =>
    api.get<Loan[]>(API_ENDPOINTS.BORROWERS.LOANS(id)),

  payments: (id: number) =>
    api.get<Payment[]>(API_ENDPOINTS.BORROWERS.PAYMENTS(id)),

  ledger: (id: number) =>
    api.get(API_ENDPOINTS.BORROWERS.LEDGER(id)),

  deactivate: (id: number) =>
    api.patch<Borrower>(API_ENDPOINTS.BORROWERS.DEACTIVATE(id)),

  reactivate: (id: number) =>
    api.patch<Borrower>(API_ENDPOINTS.BORROWERS.REACTIVATE(id)),

  uploadPhoto: (id: number, formData: FormData) =>
    api.upload<Borrower>(API_ENDPOINTS.BORROWERS.UPLOAD_PHOTO(id), formData),

  deletePhoto: (id: number) =>
    api.delete(API_ENDPOINTS.BORROWERS.DELETE_PHOTO(id)),
};
