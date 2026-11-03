import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { PaginatedResponse } from "@/types";
import type {
  SavingsChangeLogEntry,
  SavingsProduct,
  SavingsProductPayload,
  SavingsProductStatus,
  SavingsSettings,
} from "@/types/savings";

/**
 * Savings products and the module's settings. Not built on the backend yet —
 * docs/SAVINGS_BACKEND_HANDOFF.md is the contract — so every call 404s until
 * it lands and the screens show "Not connected yet".
 */
export const savingsProductService = {
  /**
   * One page of products, `getRaw` so `meta` (paging, and `meta.stats`
   * per-status counts for the tabs) survives. Params: `page`, `per_page`
   * (≤ 100), `search` (code or name), `status`.
   */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<SavingsProduct>>(API_ENDPOINTS.SAVINGS.PRODUCTS, { params }),

  /** Every product matching `params`, drained. For pickers and filters. */
  listAll: (params: Record<string, unknown> = {}): Promise<DrainResult<SavingsProduct>> =>
    fetchAllPages<SavingsProduct>(({ page, per_page }) =>
      savingsProductService.list({ ...params, page, per_page }),
    ),

  get: (id: number) => api.get<SavingsProduct>(API_ENDPOINTS.SAVINGS.PRODUCT(id)),

  create: (data: SavingsProductPayload) =>
    api.post<SavingsProduct>(API_ENDPOINTS.SAVINGS.PRODUCTS, data),

  update: (id: number, data: SavingsProductPayload) =>
    api.put<SavingsProduct>(API_ENDPOINTS.SAVINGS.PRODUCT(id), data),

  setStatus: (id: number, status: SavingsProductStatus) =>
    api.patch<SavingsProduct>(API_ENDPOINTS.SAVINGS.PRODUCT_STATUS(id), { status }),

  /** Refused (422) by the server once any account uses the product. */
  remove: (id: number) => api.delete<void>(API_ENDPOINTS.SAVINGS.PRODUCT(id)),

  history: (id: number) =>
    api.get<SavingsChangeLogEntry[]>(API_ENDPOINTS.SAVINGS.PRODUCT_HISTORY(id)),

  getSettings: () => api.get<SavingsSettings>(API_ENDPOINTS.SAVINGS.SETTINGS),

  updateSettings: (data: SavingsSettings) =>
    api.put<SavingsSettings>(API_ENDPOINTS.SAVINGS.SETTINGS, data),
};
