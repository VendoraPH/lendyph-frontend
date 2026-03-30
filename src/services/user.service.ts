import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { User, Role, UserStatus, PaginatedResponse } from "@/types";

export interface CreateUserData {
  name: string;
  username: string;
  email: string;
  mobile: string;
  password: string;
  password_confirmation: string;
  role: Role;
  branch: string;
}

export interface UpdateUserData {
  name?: string;
  username?: string;
  email?: string;
  mobile?: string;
  role?: Role;
  branch?: string;
}

export interface ResetPasswordData {
  password: string;
  password_confirmation: string;
}

export const userService = {
  list: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<User>>(API_ENDPOINTS.USERS.LIST, { params }),

  detail: (id: number) =>
    api.get<User>(API_ENDPOINTS.USERS.DETAIL(id)),

  create: (data: CreateUserData) =>
    api.post<User>(API_ENDPOINTS.USERS.CREATE, data),

  update: (id: number, data: UpdateUserData) =>
    api.put<User>(API_ENDPOINTS.USERS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.USERS.DELETE(id)),

  updateRole: (id: number, role: Role) =>
    api.patch<User>(API_ENDPOINTS.USERS.UPDATE_ROLE(id), { role }),

  toggleStatus: (id: number, status: UserStatus) =>
    api.patch<User>(API_ENDPOINTS.USERS.TOGGLE_STATUS(id), { status }),

  resetPassword: (id: number, data: ResetPasswordData) =>
    api.patch<User>(API_ENDPOINTS.USERS.RESET_PASSWORD(id), data),
};
