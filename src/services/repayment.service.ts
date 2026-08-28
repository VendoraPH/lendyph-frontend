import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type {
  Repayment,
  CreateRepaymentData,
  VoidRepaymentData,
  PaginatedResponse,
} from "@/types";

export interface RepaymentPreviewAllocation {
  schedule_id?: number;
  period?: number;
  due_date?: string;
  principal?: number;
  interest?: number;
  penalty?: number;
  amount_applied?: number;
  remaining_balance?: number;
}

export interface RepaymentPreview {
  total_paid?: number;
  total_principal?: number;
  total_interest?: number;
  total_penalty?: number;
  excess?: number;
  allocations?: RepaymentPreviewAllocation[];
  [key: string]: unknown;
}

export const repaymentService = {
  list: (loanId: number, params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Repayment>>(API_ENDPOINTS.REPAYMENTS.LIST(loanId), { params }),

  /**
   * ONE PAGE of `GET /repayments` — every loan's repayments, not one loan's.
   *
   * This was called `listAll`, which in this codebase means "drained across
   * every page" (`borrowerService.listAll`, `loanService.listAll`,
   * `shareCapitalService.ledgerListAll`). It was not a drain: it was a single
   * `api.get` whose callers passed `per_page: 100` and `per_page: 200` and
   * believed the name. The 200 was clamped to 100 and the 100 sat exactly on
   * the ceiling with nothing to say more existed, so payment #101 was
   * unreachable on both screens. Renamed rather than fixed in place, because
   * the name was the bug — `listAll` below now IS a drain.
   *
   * `getRaw`, not `get`: `RepaymentController::listAll()` returns an
   * `AnonymousResourceCollection` over a paginator, so the body is
   * `{ data, links, meta }` with no `{success, data}` envelope around it.
   * `api.get` unwrapped one level and handed back the bare row array,
   * discarding `meta` — which is why the printables payment picker read
   * `res?.data` and got `undefined` on every single request, and rendered "No
   * payment found" forever.
   *
   * Accepted params: `page`, `per_page` (clamped to 100), `search`, `status`,
   * `loan_id`, `borrower_id`, `date_from`, `date_to`.
   */
  listPage: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<Repayment>>(API_ENDPOINTS.REPAYMENTS.LIST_ALL, {
      params,
    }),

  /**
   * Every repayment matching `params`, across as many pages as it takes.
   *
   * Both consumers hold the whole set and filter it in the browser — the
   * payment history screen searches, date-ranges and status-tabs client-side,
   * and the printables picker filters as you type — so a page is not a smaller
   * version of the right answer, it is a shorter list with no way to tell.
   *
   * Returns a `DrainResult`, NOT a row array, for the reason on
   * `borrowerService.listAll`: `truncated` is part of the answer.
   */
  listAll: (params?: Record<string, unknown>): Promise<DrainResult<Repayment>> =>
    fetchAllPages<Repayment>(({ page, per_page }) =>
      repaymentService.listPage({ ...params, page, per_page }),
    ),

  create: (loanId: number, data: CreateRepaymentData) =>
    api.post<Repayment>(API_ENDPOINTS.REPAYMENTS.CREATE(loanId), data),

  preview: (
    loanId: number,
    data: { amount_paid: number; payment_date: string }
  ) => api.post<RepaymentPreview>(API_ENDPOINTS.REPAYMENTS.PREVIEW(loanId), data),

  detail: (id: number) =>
    api.get<Repayment>(API_ENDPOINTS.REPAYMENTS.DETAIL(id)),

  void: (id: number, data: VoidRepaymentData) =>
    api.patch<Repayment>(API_ENDPOINTS.REPAYMENTS.VOID(id), data),
};
