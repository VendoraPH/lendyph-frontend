import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { Borrower, BorrowerLedgerEntry, PaginatedResponse } from "@/types";

/** A valid-ID entry as returned grouped (front/back pair) by the API. */
export interface BorrowerValidId {
  id: number;
  type: string;
  custom_type_name: string | null;
  id_number: string | null;
  front_url: string | null;
  back_url: string | null;
  created_at: string;
}

export const borrowerService = {
  /**
   * `/borrowers` returns a raw Laravel paginator (`{ data, links, meta }`), not the
   * `{ success, data, message }` envelope, so it must use `getRaw` — `api.get`
   * unwraps to `data` and throws away `meta.total` / `meta.stats`, which is what
   * forced every caller to paginate and count client-side over one 15-row page.
   */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<Borrower>>(API_ENDPOINTS.BORROWERS.LIST, {
      params,
    }),

  /**
   * Every borrower matching `params`, across as many pages as it takes.
   *
   * For the screens that need the whole membership at once rather than a page of
   * it — the member pickers and the id-to-name maps behind the collateral and
   * loan forms. Those asked for `per_page: 9999` (and `per_page: 200`), which
   * `BorrowerController::index()` clamps to `min(per_page, 100)` without
   * complaining: a co-op with 130 members got 100 of them, in a response that
   * looked complete, and the other 30 were simply not in the picker. Nobody can
   * see a member who is not on the list, so the failure presented as "that
   * person is not registered" rather than as a bug.
   *
   * Returns a `DrainResult`, NOT a row array, on purpose. `truncated` is part of
   * the answer and the caller has to decide what to show for it; handing back a
   * bare array would let a screen go back to rendering an incomplete list as if
   * it were the whole thing, which is the bug itself.
   *
   * `page` and `per_page` are set by the drain — passing them in `params` has no
   * effect.
   */
  listAll: (params?: Record<string, unknown>): Promise<DrainResult<Borrower>> =>
    fetchAllPages<Borrower>(({ page, per_page }) =>
      borrowerService.list({ ...params, page, per_page }),
    ),

  detail: (id: number) =>
    api.get<Borrower>(API_ENDPOINTS.BORROWERS.DETAIL(id)),

  create: (data: Partial<Borrower>) =>
    api.post<Borrower>(API_ENDPOINTS.BORROWERS.CREATE, data),

  update: (id: number, data: Partial<Borrower>) =>
    api.put<Borrower>(API_ENDPOINTS.BORROWERS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.BORROWERS.DELETE(id)),

  bulkDelete: (ids: number[]) =>
    api.delete(API_ENDPOINTS.BORROWERS.BULK_DELETE, { data: { ids } }),

  bulkDeactivate: (ids: number[]) =>
    api.patch(API_ENDPOINTS.BORROWERS.BULK_DEACTIVATE, { ids }),

  deactivate: (id: number) =>
    api.patch<Borrower>(API_ENDPOINTS.BORROWERS.DEACTIVATE(id)),

  reactivate: (id: number) =>
    api.patch<Borrower>(API_ENDPOINTS.BORROWERS.REACTIVATE(id)),

  uploadPhoto: (id: number, formData: FormData) =>
    api.upload<Borrower>(API_ENDPOINTS.BORROWERS.UPLOAD_PHOTO(id), formData),

  deletePhoto: (id: number) =>
    api.delete(API_ENDPOINTS.BORROWERS.DELETE_PHOTO(id)),

  uploadValidId: (id: number, formData: FormData) =>
    api.upload(API_ENDPOINTS.BORROWERS.UPLOAD_VALID_ID(id), formData),

  listValidIds: (id: number) =>
    api.get<BorrowerValidId[]>(API_ENDPOINTS.BORROWERS.LIST_VALID_IDS(id)),

  deleteValidId: (id: number, validIdId: number) =>
    api.delete(API_ENDPOINTS.BORROWERS.DELETE_VALID_ID(id, validIdId)),

  ledger: (id: number, params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<BorrowerLedgerEntry>>(API_ENDPOINTS.BORROWERS.LEDGER(id), { params }),
};
