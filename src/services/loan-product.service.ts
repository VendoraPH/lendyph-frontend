import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { LoanProduct } from "@/types";

export interface CreateLoanProductData {
  name: string;
  min_interest_rate: number;
  max_interest_rate: number;
  interest_method: "straight" | "diminishing" | "upon_maturity";
  interest_rate_frequency?: "daily" | "weekly" | "bi_weekly" | "semi_monthly" | "monthly";
  min_term: number;
  max_term: number;
  term_unit?: "months" | "days";
  frequencies: string[];
  processing_fee?: number;
  service_fee?: number;
  notarial_fee?: number;
  penalty_rate?: number;
  grace_period_days?: number;
  past_due_transfer_value?: number;
  past_due_transfer_unit?: "days" | "months" | "amortization_periods";
  min_amount?: number;
  max_amount?: number;
}

export type UpdateLoanProductData = Partial<CreateLoanProductData>;

export const loanProductService = {
  /**
   * Every loan product matching `params` (`search`, `status`).
   *
   * `LoanProductController::index()` answers the whole set with `->get()`, not
   * a paginator — one request today. Drained regardless, so a paginator added
   * later cannot silently drop products from the loan forms and filters.
   * `DrainResult` for the reason on `borrowerService.listAll`; `page` and
   * `per_page` are set by the drain.
   */
  listAll: (
    params?: Record<string, unknown>,
  ): Promise<DrainResult<LoanProduct>> =>
    fetchAllPages<LoanProduct>(({ page, per_page }) =>
      api.getRaw<{ data: LoanProduct[] }>(API_ENDPOINTS.LOAN_PRODUCTS.LIST, {
        params: { ...params, page, per_page },
      }),
    ),

  detail: (id: number) =>
    api.get<LoanProduct>(API_ENDPOINTS.LOAN_PRODUCTS.DETAIL(id)),

  create: (data: CreateLoanProductData) =>
    api.post<LoanProduct>(API_ENDPOINTS.LOAN_PRODUCTS.CREATE, data),

  update: (id: number, data: UpdateLoanProductData) =>
    api.put<LoanProduct>(API_ENDPOINTS.LOAN_PRODUCTS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.LOAN_PRODUCTS.DELETE(id)),
};
