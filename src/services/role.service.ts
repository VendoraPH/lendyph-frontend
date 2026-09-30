import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";

export interface ApiRole {
  id: number;
  name: string;
  description?: string;
  permissions: string[];
  is_system?: boolean;
  is_active?: boolean;
}

export interface RolePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

export const roleService = {
  /**
   * Every role.
   *
   * `RoleController::index()` answers the whole set with `->get()`, not a
   * paginator, so today this is one request and `fetchAllPages` stops after it.
   * It is a drain anyway so that a paginator added server-side later cannot
   * quietly turn every role picker into its first page.
   *
   * Returns a `DrainResult`, NOT a row array, for the reason spelled out on
   * `borrowerService.listAll`. Screens that need every role or nothing read it
   * through `completeRows`.
   */
  listAll: (): Promise<DrainResult<ApiRole>> =>
    fetchAllPages<ApiRole>(({ page, per_page }) =>
      api.getRaw<{ data: ApiRole[] }>(API_ENDPOINTS.ROLES.LIST, {
        params: { page, per_page },
      }),
    ),

  detail: (id: number) => api.get<ApiRole>(API_ENDPOINTS.ROLES.DETAIL(id)),

  create: (data: RolePayload) =>
    api.post<ApiRole>(API_ENDPOINTS.ROLES.CREATE, data),

  update: (id: number, data: RolePayload) =>
    api.put<ApiRole>(API_ENDPOINTS.ROLES.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.ROLES.DELETE(id)),

  deactivate: (id: number) =>
    api.patch<ApiRole>(API_ENDPOINTS.ROLES.DEACTIVATE(id)),

  reactivate: (id: number) =>
    api.patch<ApiRole>(API_ENDPOINTS.ROLES.REACTIVATE(id)),
};
