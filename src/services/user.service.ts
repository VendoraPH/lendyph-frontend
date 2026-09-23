import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type { PaginatedResponse, User, UserStatus } from "@/types";

/**
 * The query `UserController::index()` accepts — its `validate()` list, plus the
 * paginator's own `page`.
 */
export interface UserListFilters {
  /** `like` over first name, last name, username and email. */
  search?: string;
  status?: UserStatus;
  /** Any user ASSIGNED to the branch, not only those whose first branch it is. */
  branch_id?: number;
  role?: string;
  page?: number;
  /** Clamped server-side to `min(max(per_page, 1), 100)`, silently. */
  per_page?: number;
}

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
  /**
   * ONE page of users, not the user list.
   *
   * `/users` answers `UserResource::collection($paginator)` — a raw Laravel
   * paginator (`{ data, links, meta }`), not the `{ success, data, message }`
   * envelope — so it has to use `getRaw`. `api.get` unwraps one level and
   * hands back the rows alone, discarding `meta.total` and `meta.last_page`;
   * that is how the users screen, calling this with no arguments, received the
   * endpoint's default page of 15 and rendered it as everyone: the table, the
   * search box, the Total card and every per-role count.
   *
   * Unlike the loan and borrower services, the declared type changed with the
   * call (it was `User[]`), so a caller that uses the result as an array
   * (`res.map`, `setUsers(res)`) no longer compiles. One that normalises both
   * shapes still does — and still gets one page. Need every user? `listAll`.
   */
  list: (params?: UserListFilters) =>
    api.getRaw<PaginatedResponse<User>>(API_ENDPOINTS.USERS.LIST, { params }),

  /**
   * Every user matching `params`, across as many pages as it takes.
   *
   * For the screens that hold the whole set rather than a page of it: the
   * users screen, which searches and counts in the browser, and the Account
   * Officer pickers on the loan forms. `UserController::index()` paginates with
   * `min(max(per_page, 1), 100)` and defaults to 15, silently, and orders
   * newest first — so a short list drops the longest-serving staff first, and
   * a missing officer reads as "not a user" rather than as a bug.
   *
   * Returns a `DrainResult`, NOT a row array, for the reason spelled out on
   * `borrowerService.listAll`: `truncated` is part of the answer and the caller
   * has to render it. `page` and `per_page` are set by the drain — they are
   * not accepted here.
   */
  listAll: (
    params?: Omit<UserListFilters, "page" | "per_page">,
  ): Promise<DrainResult<User>> =>
    fetchAllPages<User>(({ page, per_page }) =>
      userService.list({ ...params, page, per_page }),
    ),

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
