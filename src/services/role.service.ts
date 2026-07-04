import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

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
  list: () => api.get<ApiRole[]>(API_ENDPOINTS.ROLES.LIST),

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
