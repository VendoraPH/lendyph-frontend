import axiosClient from "@/lib/axios-client";
import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { User } from "@/types";

export interface UpdateMePayload {
  full_name?: string;
  email?: string;
  mobile_number?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

export const authService = {
  login: (credentials: {
    login: string;
    password: string;
    remember?: boolean;
  }) =>
    api.rawPost<{ token: string; user: User }>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    ),

  logout: () => api.post(API_ENDPOINTS.AUTH.LOGOUT),

  me: () => api.get<User>(API_ENDPOINTS.AUTH.ME),

  refresh: () =>
    api.post<{ token: string }>(API_ENDPOINTS.AUTH.REFRESH),

  /**
   * Self-service profile update. Backend whitelists full_name, email, and
   * mobile_number — username and role are admin-only and ignored if sent.
   * Bypasses the api-client wrapper because the swagger docs the response
   * as `{}` (empty), not the standard `{ success, data }` envelope, so the
   * usual auto-unwrap would throw.
   */
  updateMe: async (payload: UpdateMePayload): Promise<void> => {
    await axiosClient.patch(API_ENDPOINTS.AUTH.UPDATE_ME, payload);
  },

  /**
   * Change current user's password. Backend revokes all *other* sanctum
   * tokens on success — the calling session keeps working.
   */
  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await axiosClient.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
  },
};
