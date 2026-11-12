/**
 * The Savings dashboard (gap round S5). `savings:view`; the server scopes it
 * to the caller's branches (another `branch_id` answers 403) and sends every
 * figure.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { SavingsDashboard, SavingsDashboardQuery } from "@/types/savings-insight";

export const savingsDashboardService = {
  get: (query: SavingsDashboardQuery = {}) =>
    api.get<SavingsDashboard>(API_ENDPOINTS.SAVINGS.DASHBOARD, { params: query }),
};
