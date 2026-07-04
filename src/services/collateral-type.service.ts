import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { CollateralType, PaginatedResponse } from "@/types";

export interface CreateCollateralTypeData {
  name: string;
  detail_field_label: string;
  amount_field_label: string;
  source: "manual" | "share_capital";
  display_order: number;
  is_visible: boolean;
}

export type UpdateCollateralTypeData = Partial<CreateCollateralTypeData>;

function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: T[] }).data)) {
    return (res as { data: T[] }).data;
  }
  return [];
}

export const collateralTypeService = {
  list: async (): Promise<CollateralType[]> => {
    const res = await api.get<PaginatedResponse<CollateralType> | CollateralType[]>(
      API_ENDPOINTS.COLLATERAL_TYPES.LIST,
    );
    const rows = unwrapList<CollateralType>(res);
    return [...rows].sort((a, b) => a.display_order - b.display_order);
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
