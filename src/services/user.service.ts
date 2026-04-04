import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { User } from "@/types";

export interface CreateUserData {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  mobile_number?: string;
  branch_id: number;
  role: string;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  branch_id?: number;
  role?: string;
}

export interface ResetPasswordData {
  password: string;
  password_confirmation: string;
}

export const userService = {
  list: (params?: Record<string, unknown>) =>
    api.get<User[]>(API_ENDPOINTS.USERS.LIST, { params }),

  detail: (id: number) =>
    api.get<User>(API_ENDPOINTS.USERS.DETAIL(id)),

  create: (data: CreateUserData) =>
    api.post<User>(API_ENDPOINTS.USERS.CREATE, data),

  update: (id: number, data: UpdateUserData) =>
    api.put<User>(API_ENDPOINTS.USERS.UPDATE(id), data),

  delete: (id: number) =>
    api.delete(API_ENDPOINTS.USERS.DELETE(id)),

  deactivate: (id: number) =>
    api.patch<User>(API_ENDPOINTS.USERS.DEACTIVATE(id)),

  reactivate: (id: number) =>
    api.patch<User>(API_ENDPOINTS.USERS.REACTIVATE(id)),

  resetPassword: (id: number, data: ResetPasswordData) =>
    api.post<void>(API_ENDPOINTS.USERS.RESET_PASSWORD(id), data),

  updateRole: (id: number, data: { role: string }) =>
    api.put<User>(API_ENDPOINTS.USERS.UPDATE_ROLE(id), data),

  toggleStatus: (id: number) =>
    api.patch<User>(API_ENDPOINTS.USERS.TOGGLE_STATUS(id)),
};
