import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export const reportService = {
  list: () => api.get(API_ENDPOINTS.REPORTS.LIST),

  generate: (data: { type: string; date_from?: string; date_to?: string }) =>
    api.post(API_ENDPOINTS.REPORTS.GENERATE, data),

  dailyCollection: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.DAILY_COLLECTION, { params }),

  portfolio: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.PORTFOLIO, { params }),

  income: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.REPORTS.INCOME, { params }),
};
