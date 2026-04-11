import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export const dashboardService = {
  stats: () =>
    api.get(API_ENDPOINTS.DASHBOARD.STATS),

  collectionsTrend: () =>
    api.get(API_ENDPOINTS.DASHBOARD.COLLECTIONS_TREND),

  dailyDues: (params?: Record<string, unknown>) =>
    api.get(API_ENDPOINTS.DASHBOARD.DAILY_DUES, { params }),

  recentTransactions: () =>
    api.get(API_ENDPOINTS.DASHBOARD.RECENT_TRANSACTIONS),
};
