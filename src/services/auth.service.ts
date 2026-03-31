import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { User } from "@/types";

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

  register: (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => api.post<{ user: User }>(API_ENDPOINTS.AUTH.REGISTER, data),

  logout: () => api.post(API_ENDPOINTS.AUTH.LOGOUT),

  me: () => api.get<User>(API_ENDPOINTS.AUTH.ME),

  refresh: () =>
    api.post<{ token: string }>(API_ENDPOINTS.AUTH.REFRESH),

  forgotPassword: (data: { email: string }) =>
    api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data),

  resetPassword: (data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data),
};
