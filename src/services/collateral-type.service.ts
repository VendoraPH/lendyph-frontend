/**
 * Collateral types service.
 *
 * Currently mock-backed via `collateral-storage.ts`. To wire to real
 * backend later, swap the bodies for `api.get/post/put/delete` against
 * `API_ENDPOINTS.COLLATERAL_TYPES.*`.
 */

import type { CollateralType } from "@/types";
import { collateralTypeStorage } from "@/lib/collateral-storage";

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
  list: (): Promise<CollateralType[]> => collateralTypeStorage.list(),

  detail: (id: number): Promise<CollateralType | null> =>
    collateralTypeStorage.detail(id),

  create: (data: CreateCollateralTypeData): Promise<CollateralType> =>
    collateralTypeStorage.create(data),

  update: (
    id: number,
    data: UpdateCollateralTypeData,
  ): Promise<CollateralType> => collateralTypeStorage.update(id, data),

  delete: (id: number): Promise<void> => collateralTypeStorage.remove(id),

  reorder: (ids: number[]): Promise<CollateralType[]> =>
    collateralTypeStorage.reorder(ids),
};
