import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { DashboardOverview, PortfolioSummary } from "@/types";

export const dashboardService = {
  overview: () =>
    api.get<DashboardOverview>(API_ENDPOINTS.DASHBOARD.OVERVIEW),

  portfolioSummary: () =>
    api.get<PortfolioSummary>(API_ENDPOINTS.DASHBOARD.PORTFOLIO_SUMMARY),

  collectionRate: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.DASHBOARD.COLLECTION_RATE, { params }),

  charts: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.DASHBOARD.CHARTS, { params }),
};
