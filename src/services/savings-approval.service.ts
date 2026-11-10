/**
 * The savings approvals queue (maker-checker, savings design §2). The server
 * refuses (403) a maker approving their own request, or one checker
 * approving twice; the screen disables Approve for them with the reason.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { PaginatedResponse, SavingsApproval } from "@/types";

const E = API_ENDPOINTS.SAVINGS;

export const savingsApprovalService = {
  /** One page, `getRaw` so `meta` survives. Params: `page`, `per_page`, `status`, `kind`, `branch_id`. */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<SavingsApproval> & { meta: { stats?: Record<string, number> } }>(E.APPROVALS, {
      params,
    }),
  approve: (id: number) => api.post<SavingsApproval>(E.APPROVAL_APPROVE(id)),
  reject: (id: number, reason: string) => api.post<SavingsApproval>(E.APPROVAL_REJECT(id), { reason }),
  /** The maker withdraws their own request. */
  cancel: (id: number, reason?: string) => api.post<SavingsApproval>(E.APPROVAL_CANCEL(id), reason ? { reason } : {}),
};
