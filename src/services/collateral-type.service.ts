import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { CollateralType } from "@/types";

export interface CreateCollateralTypeData {
  name: string;
  detail_field_label: string;
  amount_field_label: string;
  source: "manual" | "share_capital";
  display_order: number;
  is_visible: boolean;
}

export type UpdateCollateralTypeData = Partial<CreateCollateralTypeData>;

export const collateralTypeService = {
  /**
   * Every collateral type, in `display_order`.
   *
   * `CollateralTypeController::index()` answers the whole set with `->get()`,
   * not a paginator — one request today. Drained regardless, so a paginator
   * added later cannot silently drop types from the pickers and value lookups.
   * Sorted here, after the drain, so the order holds across pages too.
   * `DrainResult` for the reason on `borrowerService.listAll`.
   */
  listAll: async (): Promise<DrainResult<CollateralType>> => {
    const drain = await fetchAllPages<CollateralType>(({ page, per_page }) =>
      api.getRaw<{ data: CollateralType[] }>(API_ENDPOINTS.COLLATERAL_TYPES.LIST, {
        params: { page, per_page },
      }),
    );
    return {
      ...drain,
      rows: [...drain.rows].sort((a, b) => a.display_order - b.display_order),
    };
  },

  detail: (id: number): Promise<CollateralType> =>
    api.get<CollateralType>(API_ENDPOINTS.COLLATERAL_TYPES.DETAIL(id)),

  create: (data: CreateCollateralTypeData): Promise<CollateralType> =>
    api.post<CollateralType>(API_ENDPOINTS.COLLATERAL_TYPES.CREATE, data),

  update: (
    id: number,
    data: UpdateCollateralTypeData,
  ): Promise<CollateralType> =>
    api.put<CollateralType>(API_ENDPOINTS.COLLATERAL_TYPES.UPDATE(id), data),

  delete: (id: number): Promise<void> =>
    api.delete(API_ENDPOINTS.COLLATERAL_TYPES.DELETE(id)),

  reorder: (ids: number[]): Promise<CollateralType[]> =>
    api.post<CollateralType[]>(API_ENDPOINTS.COLLATERAL_TYPES.REORDER, { ids }),
};
