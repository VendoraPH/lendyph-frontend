import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  ExecutiveAttention,
  ExecutiveBranches,
  ExecutiveOverview,
  ExecutiveQuery,
  ExecutiveTrends,
  ExecutiveTurnaround,
  ParLevel,
  ParLoansPage,
  ShareCapitalControl,
} from "@/types/executive-dashboard";

/** EB-D2's endpoints (`ExecutiveBooksRequest`) take a custom range as `from` and `to`, not `date_from` and `date_to`. */
export function booksParams(query: ExecutiveQuery): Record<string, string | number> {
  const { date_from, date_to, ...rest } = query;
  return {
    ...rest,
    ...(date_from !== undefined ? { from: date_from } : {}),
    ...(date_to !== undefined ? { to: date_to } : {}),
  } as Record<string, string | number>;
}

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

  // EB-D2's endpoints read the same query, with the range as `from` and `to`.
  trends: (query: ExecutiveQuery) =>
    api.get<ExecutiveTrends>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_TRENDS, { params: booksParams(query) }),

  attention: (query: ExecutiveQuery) =>
    api.get<ExecutiveAttention>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_ATTENTION, { params: booksParams(query) }),

  turnaround: (query: ExecutiveQuery) =>
    api.get<ExecutiveTurnaround>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_TURNAROUND, { params: booksParams(query) }),

  /** A position as of today: only the branch narrows it (no period, no loan filters). */
  shareCapitalControl: (query: ExecutiveQuery) =>
    api.get<ShareCapitalControl>(API_ENDPOINTS.DASHBOARD.EXECUTIVE_SHARE_CAPITAL_CONTROL, {
      params: query.branch_id !== undefined ? { branch_id: query.branch_id } : {},
    }),
};
