import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { Fee, CreateFeeData, UpdateFeeData } from "@/types";

export const feeService = {
  list: (params?: Record<string, unknown>) =>
    api.get<Fee[]>(API_ENDPOINTS.FEES.LIST, { params }),

  detail: (id: number) =>
    api.get<Fee>(API_ENDPOINTS.FEES.DETAIL(id)),

  create: (data: CreateFeeData) =>
    api.post<Fee>(API_ENDPOINTS.FEES.CREATE, data),

  update: (id: number, data: UpdateFeeData) =>
    api.put<Fee>(API_ENDPOINTS.FEES.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.FEES.DELETE(id)),
};
