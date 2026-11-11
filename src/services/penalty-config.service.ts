import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { PenaltyConfig, PenaltyConfigStatus, SavePenaltyConfigData } from "@/types";

/**
 * Settings → Penalties. The endpoints are not built yet (ClickUp 14zfbg0d0dh),
 * so the screen sits behind NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS and shows "not
 * connected yet" on a 404/501.
 */
export const penaltyConfigService = {
  /** Every configuration, drained: one missing would hide a product's penalty. */
  listAll: (): Promise<DrainResult<PenaltyConfig>> =>
    fetchAllPages<PenaltyConfig>(({ page, per_page }) =>
      api.getRaw<{ data: PenaltyConfig[] }>(API_ENDPOINTS.PENALTY_CONFIGS.LIST, {
        params: { page, per_page },
      }),
    ),

  create: (data: SavePenaltyConfigData) =>
    api.post<PenaltyConfig>(API_ENDPOINTS.PENALTY_CONFIGS.CREATE, data),

  update: (id: number, data: SavePenaltyConfigData) =>
    api.put<PenaltyConfig>(API_ENDPOINTS.PENALTY_CONFIGS.UPDATE(id), data),

  setStatus: (id: number, status: PenaltyConfigStatus) =>
    api.patch<PenaltyConfig>(API_ENDPOINTS.PENALTY_CONFIGS.STATUS(id), { status }),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.PENALTY_CONFIGS.DELETE(id)),
};
