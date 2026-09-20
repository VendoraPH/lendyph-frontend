import type { Permission } from "./rbac";

export type UserStatus = "active" | "inactive";

export interface UserBranch {
  id: number;
  name: string;
  code: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  email: string;
  mobile_number?: string | null;
  status: UserStatus;
  last_login_at?: string | null;
  branches: UserBranch[];
  roles: string[];
  permissions: Permission[];
  avatar?: string | null;
  /**
   * Set when an administrator resets this user's password. While true the API
   * answers 423 to every authenticated request bar `GET /auth/me`,
   * `POST /auth/change-password` and `POST /auth/logout`, and the app holds the
   * user on /change-password. Present on BOTH envelopes the app reads:
   * `GET /auth/me` (under `data`) and the login response (under `user`).
   *
   * Non-optional per the API contract, but read it as `=== true` rather than
   * `!== false`: the auth store is persisted to localStorage, so sessions that
   * predate this field rehydrate with it `undefined`.
   */
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}
