import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  ExecutiveBranches,
  ExecutiveOverview,
  ExecutiveQuery,
  ParLevel,
  ParLoansPage,
} from "@/types/executive-dashboard";

/** One page of the PAR loans; the server pages them, most days late first. */
export const PAR_LOANS_PER_PAGE = 25;

/**
 * The executive dashboard's own endpoints (Phase 6 EB-D1). Each takes a preset
 * by name, or `custom` with its two dates: the server works the period out in
 * Manila, so the browser's zone never moves it.
 */
export const executiveDashboardService = {
  overview: (query: ExecutiveQuery) =>
    api.get<ExecutiveOverview>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_OVERVIEW, { params: query }),

  branches: (query: ExecutiveQuery) =>
    api.get<ExecutiveBranches>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_BRANCHES, { params: query }),

  /** `getRaw`: the paging and the totals are in `meta`, which `api.get` drops. */
  parLoans: (
    query: ExecutiveQuery,
    { par, page, perPage = PAR_LOANS_PER_PAGE }: { par: ParLevel; page: number; perPage?: number },
  ) =>
    api.getRaw<ParLoansPage>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_PAR_LOANS, {
      params: { ...query, par, page, per_page: perPage },
    }),
};
