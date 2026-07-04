import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";

export interface ApiBranch {
  id: number;
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
  is_active: boolean;
}

export interface CreateBranchData {
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
}

export interface UpdateBranchData {
  name?: string;
  code?: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}

export interface PublicBranch {
  id: number;
  name: string;
  city?: string;
}

export const branchService = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiBranch[]>(API_ENDPOINTS.BRANCHES.LIST, { params }),

  // Unauthenticated read for the public registration branch picker.
  // Backend returns a slim shape — no internal fields.
  publicList: () =>
    api.get<PublicBranch[]>(API_ENDPOINTS.BRANCHES.PUBLIC_LIST),

  detail: (id: number) =>
    api.get<ApiBranch>(API_ENDPOINTS.BRANCHES.DETAIL(id)),

  create: (data: CreateBranchData) =>
    api.post<ApiBranch>(API_ENDPOINTS.BRANCHES.CREATE, data),

  update: (id: number, data: UpdateBranchData) =>
    api.put<ApiBranch>(API_ENDPOINTS.BRANCHES.UPDATE(id), data),
};
