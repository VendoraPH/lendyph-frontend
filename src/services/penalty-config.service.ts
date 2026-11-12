import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { PenaltyConfig, PenaltyConfigStatus, SavePenaltyConfigData } from "@/types";

/**
 * Settings → Penalties (`/penalty-configs`, backend B2). The screen sits behind
 * NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS and shows "not connected yet" on a
 * 404/501 from an API that predates it.
 */
export const penaltyConfigService = {
  /** Every configuration, drained, so none is missing from the list. */
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
