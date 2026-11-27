import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

/** `GET /api/health` — flat, no `{ data }` envelope (`HealthController`). */
export interface HealthStatus {
  status: string;
  timestamp?: string;
  commit?: string | null;
  branch?: string | null;
  env?: string;
}

export const systemService = {
  /**
   * `getRaw`, not `get`: the health body is flat, and `api.get` returns
   * `response.data.data` — `undefined` here — so the sidebar's API dot read
   * every healthy API as "unreachable" and showed red on every deployment.
   */
  health: () => api.getRaw<HealthStatus>(API_ENDPOINTS.SYSTEM.HEALTH),
};
