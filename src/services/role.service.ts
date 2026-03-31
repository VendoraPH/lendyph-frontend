import { api } from "@/lib/api-client";

export interface ApiRole {
  id: number;
  name: string;
  permissions: string[];
}

export const roleService = {
  list: () => api.get<ApiRole[]>("/roles"),
};
