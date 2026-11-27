import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { DailyDuesResponse } from "@/types";

export const dashboardService = {
  stats: () =>
    api.get(API_ENDPOINTS.DASHBOARD.STATS),

  collectionsTrend: () =>
    api.get(API_ENDPOINTS.DASHBOARD.COLLECTIONS_TREND),

  // `getRaw`, not `get`: the pie's figures are in `summary`, beside `data`,
  // and `get` returns `data` alone.
  dailyDues: <Row>(params?: Record<string, unknown>) =>
    api.getRaw<DailyDuesResponse<Row>>(API_ENDPOINTS.DASHBOARD.DAILY_DUES, { params }),

  recentTransactions: () =>
    api.get(API_ENDPOINTS.DASHBOARD.RECENT_TRANSACTIONS),
};
