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
  branch_ids: number[];
  /**
   * The legacy single assignment, sent alongside `branch_ids` for as long as
   * the API accepts both. It is what keeps either merge order safe: a backend
   * without multi-branch ignores `branch_ids` and would 422 on a missing
   * `branch_id`. Build it with `primaryBranchId()` — see @/lib/user-branches.
   */
  branch_id?: number;
  role: string;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  email?: string;
  /**
   * `null` clears the number. Omitting the key leaves it untouched, so the two
   * are NOT interchangeable — sending `undefined` for an emptied field is what
   * made clearing a phone number a no-op for as long as this screen existed.
   */
  mobile_number?: string | null;
  branch_ids?: number[];
  /** @see CreateUserData.branch_id — same dual-contract reason. */
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

  deactivate: (id: number) =>
    api.patch<User>(API_ENDPOINTS.USERS.DEACTIVATE(id)),

  reactivate: (id: number) =>
    api.patch<User>(API_ENDPOINTS.USERS.REACTIVATE(id)),

  resetPassword: (id: number, data: ResetPasswordData) =>
    api.post<void>(API_ENDPOINTS.USERS.RESET_PASSWORD(id), data),
};
