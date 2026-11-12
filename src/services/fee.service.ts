import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { Fee, CreateFeeData, UpdateFeeData } from "@/types";
import type { FeeFormulaCheck, FeeFormulaCheckRequest } from "@/types/fee";

export const feeService = {
  /**
   * Every fee matching `params`.
   *
   * `FeeController::index()` answers the whole set with `->get()`, not a
   * paginator — one request today. Drained regardless, because a fee missing
   * from the loan form is a fee nobody is charged, and nothing on screen would
   * say so. `DrainResult` for the reason on `borrowerService.listAll`; `page`
   * and `per_page` are set by the drain.
   */
  listAll: (params?: Record<string, unknown>): Promise<DrainResult<Fee>> =>
    fetchAllPages<Fee>(({ page, per_page }) =>
      api.getRaw<{ data: Fee[] }>(API_ENDPOINTS.FEES.LIST, {
        params: { ...params, page, per_page },
      }),
    ),

  detail: (id: number) =>
    api.get<Fee>(API_ENDPOINTS.FEES.DETAIL(id)),

  create: (data: CreateFeeData) =>
    api.post<Fee>(API_ENDPOINTS.FEES.CREATE, data),

  update: (id: number, data: UpdateFeeData) =>
    api.put<Fee>(API_ENDPOINTS.FEES.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.FEES.DELETE(id)),

  /**
   * The server's check of a written formula, with the fee it gives on a sample
   * loan. Writes nothing. A mistake answers 422 on `formula_expression` (or on
   * `sample` when the sample loan divides by zero or goes negative).
   */
  checkFormula: (body: FeeFormulaCheckRequest, signal?: AbortSignal) =>
    api.post<FeeFormulaCheck>(API_ENDPOINTS.FEES.FORMULA_CHECK, body, { signal }),
};
