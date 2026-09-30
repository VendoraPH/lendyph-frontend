import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { PaginatedResponse, StaffMember } from "@/types";

/** The query `StaffController::index()` accepts (`ListStaffRequest::rules()`). */
export interface StaffListFilters {
  /**
   * Matches first name, last name, or "first last" — never username or email.
   * More than 100 characters is a 422.
   */
  search?: string;
  page?: number;
  /** Clamped server-side to `min(max(per_page, 1), 100)`, silently. Defaults to 15. */
  per_page?: number;
}

export const staffService = {
  /**
   * ONE page of active staff as `{ id, full_name }`, ordered by first name,
   * last name, then id.
   *
   * The Account Officer pickers read this, not `/users`: that endpoint is
   * behind `users:view`, which only admin and super_admin hold, so a loan
   * officer got an empty picker. This one answers anyone holding
   * `loans:create` or `loans:update`, and 403s everyone else.
   *
   * A raw Laravel paginator (`{ data, links, meta }`), hence `getRaw`: `api.get`
   * would hand back the rows alone and drop `meta.total`, which the picker
   * needs to say how many more there are.
   */
  list: (params?: StaffListFilters) =>
    api.getRaw<PaginatedResponse<StaffMember>>(API_ENDPOINTS.STAFF.LIST, { params }),
};
