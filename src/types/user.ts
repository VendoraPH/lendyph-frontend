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

/** One of the signed-in user's own roles, as `GET /auth/me` sends it. */
export interface UserRoleDetail {
  /** The role key. Some responses name it `name`. */
  key?: string | null;
  name?: string | null;
  display_name?: string | null;
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
  /**
   * The chosen primary branch (Phase 6 MB-BE6): one of `branches`, or null for
   * Organisation-wide. Sent with `branches`; absent where they aren't, and on
   * an API that predates it, so read a missing key as unknown, not as null.
   */
  primary_branch_id?: number | null;
  /** The primary branch by name, "Organisation-wide" for none. Sent with `primary_branch_id`. */
  primary_branch_name?: string | null;
  roles: string[];
  /**
   * `GET /auth/me` only: the caller's own roles with their saved display
   * names, readable without `users:view`. Absent on an API that predates it,
   * and in sessions persisted before it.
   */
  role_details?: UserRoleDetail[];
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
  /**
   * `GET /users` rows only: whether the caller may edit, reset the password
   * of, deactivate or activate this user. False when those requests would
   * answer 404 for the caller (a super_admin target, a branch the caller
   * doesn't hold, or permissions the caller doesn't have). Missing on every
   * other endpoint and on an API that predates it: read it as unknown.
   */
  can_manage?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * One line of `GET /users/{user}/branch-history` (Phase 6 MB-BE6): a branch
 * assignment (`branches`: `from` and `to` are lists of branch names) or a
 * primary-branch change (`primary`: a branch name or "Organisation-wide";
 * `from` is null when the user was created), read from the audit rows. The
 * server writes `description` in words and names a branch the caller can't
 * see "Another branch".
 */
export interface UserBranchHistoryEntry {
  id: number;
  /** "primary" or "branches"; read any other as a branch change. */
  kind: string;
  from: string | string[] | null;
  to: string | string[];
  description: string;
  /** The person who made the change, or "System". */
  by: string;
  at: string | null;
}
