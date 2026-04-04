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

  logout: () => api.post(API_ENDPOINTS.AUTH.LOGOUT),

  me: () => api.get<User>(API_ENDPOINTS.AUTH.ME),

  refresh: () =>
    api.post<{ token: string }>(API_ENDPOINTS.AUTH.REFRESH),
};
