/**
 * Savings interest runs (savings design §2 and §5). The server computes every
 * figure: preview writes nothing, create saves one draft per branch, then a
 * different user approves and someone with `savings:post` posts it.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { InterestRun, InterestRunPreview, InterestRunRequest, PaginatedResponse } from "@/types";

const E = API_ENDPOINTS.SAVINGS;

export const savingsInterestService = {
  preview: (data: InterestRunRequest) => api.post<InterestRunPreview>(E.INTEREST_RUNS_PREVIEW, data),
  /** One draft per branch. 409 while a live run exists for the period. */
  create: (data: InterestRunRequest) => api.post<InterestRun[]>(E.INTEREST_RUNS, data),
  /** Params: `page`, `per_page`, `status`, `product_id`, `branch_id`. */
  list: (params?: Record<string, unknown>) => api.getRaw<PaginatedResponse<InterestRun>>(E.INTEREST_RUNS, { params }),
  get: (id: number) => api.get<InterestRun>(E.INTEREST_RUN(id)),
  /** 403 when the checker created it. */
  approve: (id: number) => api.post<InterestRun>(E.INTEREST_RUN_APPROVE(id)),
  reject: (id: number, reason: string) => api.post<InterestRun>(E.INTEREST_RUN_REJECT(id), { reason }),
  /** 409 when it isn't approved, is already posted, or the figures changed. */
  post: (id: number) => api.post<InterestRun>(E.INTEREST_RUN_POST(id)),
  /** Only the latest posted run for its product and branch. */
  reverse: (id: number, reason: string) => api.post<InterestRun>(E.INTEREST_RUN_REVERSE(id), { reason }),
};
