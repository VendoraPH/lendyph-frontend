import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { Loan, LoanSchedule, LoanLedgerEntry, PaginatedResponse, AutoPayToggleData, AutoPaySettings } from "@/types";
import type { ApiAmortizationSchedule } from "@/lib/amortization";

export type ReleaseLoanPayload = {
  insurance_premium_percentage?: number;
  insurance_premium_amount?: number;
  insurance_payment_type?: "full" | "partial";
  insurance_partial_amount?: number;
  insurance_remaining_balance?: number;
};

export const loanService = {
  /**
   * `/loans` answers with a raw Laravel paginator (`{ data, links, meta }`),
   * not the `{ success, data, message }` envelope, so it has to use `getRaw`.
   * `api.get` unwraps one level and hands back the rows alone, discarding
   * `meta.total`, `meta.last_page` and `meta.stats` — so callers could not tell
   * a complete list from a clamped first page. That is what forced the loans
   * list screen to paginate, filter and count client-side over one 15-row page,
   * and what let the payments screen ask for 500 loans, receive 100, and have
   * no way to notice.
   *
   * The static type does not change: `api.get` and `api.getRaw` share a
   * signature, and both were already declared `PaginatedResponse<Loan>` even
   * though `api.get` returned a bare array at runtime. TypeScript therefore
   * flags nothing here, so all seven call sites were checked by hand — every
   * one already normalises both shapes (`Array.isArray(res) ? res : res.data`),
   * so they took the array branch before and take the `.data` branch now.
   *
   * Accepted params (`LoanController::index()`): `page`, `per_page` (silently
   * clamped to 100 — asking for more does not fail, it just returns less),
   * `search`, `status` (one status, a comma-separated list, or the virtual
   * `active`), `branch_id`, `borrower_id`, `loan_product_id`,
   * `date_from`/`date_to` (inclusive whole-day on `created_at`), `sort` and
   * `dir`. `sort` accepts columns only — there is no key for the
   * schedule-derived `next_due_date` or `overdue_amount`.
   */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<Loan>>(API_ENDPOINTS.LOANS.LIST, { params }),

  /**
   * Every loan matching `params`, across as many pages as it takes.
   *
   * For the screens that have to hold the whole set rather than a page of it —
   * the ones filtering or aggregating on something `?status=` cannot express.
   * The restructure form is the case in hand: "eligible for restructure" is a
   * guard inside `LoanService::assertRestructureInvariants()`, not a query
   * parameter, so the filter has to run client-side and therefore has to see
   * every row. It asked for `per_page: 200`, which `LoanController::index()`
   * clamps to `min(max(per_page, 1), 100)` in silence, so a member past their
   * hundredth loan had loans that could not be restructured from that screen at
   * all — presented as "this member has nothing to restructure".
   *
   * Prefer a server-side filter where one exists. `?status=active` and
   * `?status=past_due` both exist and both agree with their `meta.stats` entry,
   * so a screen wanting either should page normally and read the badge rather
   * than drain and count.
   *
   * Returns a `DrainResult`, NOT a row array, for the reason spelled out on
   * `borrowerService.listAll`: `truncated` is part of the answer, and handing
   * back a bare array would let a screen render an incomplete list as if it
   * were whole.
   *
   * `page` and `per_page` are set by the drain — passing them in `params` has
   * no effect.
   */
  listAll: (params?: Record<string, unknown>): Promise<DrainResult<Loan>> =>
    fetchAllPages<Loan>(({ page, per_page }) =>
      loanService.list({ ...params, page, per_page }),
    ),

  detail: (id: number) =>
    api.get<Loan>(API_ENDPOINTS.LOANS.DETAIL(id)),

  create: (data: Partial<Loan>) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.CREATE, data),

  update: (id: number, data: Partial<Loan>) =>
    api.put<Loan>(API_ENDPOINTS.LOANS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.LOANS.DELETE(id)),

  approve: (id: number, data?: { approval_remarks?: string }) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.APPROVE(id), data),

  reject: (id: number, data?: { approval_remarks?: string }) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.REJECT(id), data),

  release: (id: number, payload?: ReleaseLoanPayload) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.RELEASE(id), payload),

  submit: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.SUBMIT(id)),

  void: (id: number) =>
    api.patch<Loan>(API_ENDPOINTS.LOANS.VOID(id)),

  amortizationPreview: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.AMORTIZATION_PREVIEW(id)),

  amortizationSchedule: (id: number) =>
    api.get<ApiAmortizationSchedule>(API_ENDPOINTS.LOANS.AMORTIZATION_SCHEDULE(id)),

  /** Loan balance summary (replaces the old /schedule endpoint) */
  summary: (id: number) =>
    api.get(API_ENDPOINTS.LOANS.SUMMARY(id)),

  /** Alias — maps to amortization-schedule for backward compat */
  schedule: (id: number) =>
    api.get<LoanSchedule[]>(API_ENDPOINTS.LOANS.AMORTIZATION_SCHEDULE(id)),

  /**
   * `interest_option` is required by the API — it decides whether the
   * outstanding interest is collected as a repayment before the loan extends
   * ("pay") or carries into the new period on top of the fresh cycle
   * ("defer"). The API performs the collection itself, in the same
   * transaction as the extension.
   */
  extend: (id: number, data: { remarks?: string; interest_option: "pay" | "defer" }) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.EXTEND(id), data),

  restructure: (id: number, data: Record<string, unknown>) =>
    api.post<Loan>(API_ENDPOINTS.LOANS.RESTRUCTURE(id), data),

  /** Debit/credit postings against the loan's interest — see `LoanLedgerEntry`. */
  ledgerEntries: (id: number) =>
    api.get<PaginatedResponse<LoanLedgerEntry>>(API_ENDPOINTS.LOANS.LEDGER_ENTRIES(id)),

  toggleAutoPay: (id: number, data: AutoPayToggleData) =>
    api.patch<AutoPaySettings>(API_ENDPOINTS.LOANS.TOGGLE_AUTO_PAY(id), data),
};
