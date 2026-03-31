import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { AuditLog, PaginatedResponse } from "@/types";

export const auditService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<AuditLog>>(API_ENDPOINTS.AUDIT_LOGS.LIST, {
      params,
    }),

  detail: (id: number) =>
    api.get<AuditLog>(API_ENDPOINTS.AUDIT_LOGS.DETAIL(id)),

  export: (params?: Record<string, unknown>) =>
    api.get<Blob>(API_ENDPOINTS.AUDIT_LOGS.EXPORT, {
      params,
      responseType: "blob",
    } as Record<string, unknown>),
};
