import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export const systemService = {
  health: () =>
    api.get<{ status: string }>(API_ENDPOINTS.SYSTEM.HEALTH),
};
