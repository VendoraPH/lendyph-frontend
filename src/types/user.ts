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
  /**
   * The branches this user is assigned to.
   *
   * **Optional, and it has to stay optional.** `api.get<User>()` is an
   * unchecked cast of untyped JSON, so a required `branches` would not be a
   * guarantee — it would only stop TypeScript from asking for a guard, while
   * three real sources still answer `undefined`: an API that has not shipped
   * its half of multi-branch yet, an endpoint that was missed, and
   * localStorage (see `must_change_password` below — the auth store is
   * persisted, so pre-change sessions rehydrate the old shape).
   *
   * Read it with `userBranches()` from @/lib/user-branches, which understands
   * both shapes. Dereferencing it directly is a white screen, not a blank field.
   */
  branches?: UserBranch[];
  /**
   * @deprecated The pre-multi-branch single assignment. Still emitted by the
   * API while both shapes are supported, and still sitting in every persisted
   * session from before the change. Do not read it directly — `userBranches()`
   * falls back to it for you.
   */
  branch?: UserBranch | null;
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
