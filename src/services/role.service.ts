import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export interface ApiRole {
  id: number;
  name: string;
  permissions: string[];
}

export const roleService = {
  list: () => api.get<ApiRole[]>(API_ENDPOINTS.ROLES.LIST),

  detail: (id: number) => api.get<ApiRole>(API_ENDPOINTS.ROLES.DETAIL(id)),
};
