import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Payment, PaginatedResponse } from "@/types";

export const paymentService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Payment>>(API_ENDPOINTS.PAYMENTS.LIST, {
      params,
    }),

  detail: (id: number) =>
    api.get<Payment>(API_ENDPOINTS.PAYMENTS.DETAIL(id)),

  create: (data: Partial<Payment>) =>
    api.post<Payment>(API_ENDPOINTS.PAYMENTS.CREATE, data),

  update: (id: number, data: Partial<Payment>) =>
    api.put<Payment>(API_ENDPOINTS.PAYMENTS.UPDATE(id), data),

  void: (id: number, reason?: string) =>
    api.post(API_ENDPOINTS.PAYMENTS.VOID(id), { reason }),
};
