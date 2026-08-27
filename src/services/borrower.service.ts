import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
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
