import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { AuditLog, PaginatedResponse } from "@/types";

export const auditService = {
  /**
   * `/audit-logs` answers with a raw Laravel paginator (`{ data, links, meta }`),
   * not the `{ success, data, message }` envelope, so it has to use `getRaw` —
   * the same correction `borrowerService.list` and `loanService.list` already
   * carry, and this was the last list service still on `api.get`.
   *
   * It matters more here than it looks. `api.get` unwraps one level and returns
   * the rows alone, so `meta` never reached the screen at all: the audit page
   * kept a `meta` state, and it was dead — permanently null, because the
   * `Array.isArray(res)` branch was the only one that could ever run. The page
   * then showed one clamped page of rows under a "Total Events" card reading
   * `logs.length`, so the count agreed with the table and both were wrong, with
   * nothing on the page able to tell anyone otherwise.
   *
   * The static type does not change: `api.get` and `api.getRaw` share a
   * signature and both were already declared `PaginatedResponse<AuditLog>` even
   * though `api.get` returned a bare array at runtime, so TypeScript flagged
   * nothing. The audit page is the only caller and it has been updated.
   *
   * Accepted params (`AuditLogController::index()` / `buildQuery()`): `page`,
   * `per_page` (clamped to `min(per_page, 100)` — note there is no `max(…, 1)`
   * here, unlike `LoanController`), `search`, `user_id`, `action`,
   * `auditable_type` (a LIKE, not an exact match) and `date_from`/`date_to`.
   */
  list: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<AuditLog>>(API_ENDPOINTS.AUDIT_LOGS.LIST, {
      params,
    }),

  detail: (id: number) =>
    api.get<AuditLog>(API_ENDPOINTS.AUDIT_LOGS.DETAIL(id)),

  /**
   * The CSV of every row matching `params` — a separate, deliberately
   * UNPAGINATED endpoint (`AuditLogController::export()` chunks the whole query
   * at 500 a time). It does not share the list's page, so the button means what
   * it says. Pass the same filters the list is showing, `per_page`/`page`
   * excluded: they are not accepted there and would be misleading if they were.
   */
  export: (params?: Record<string, unknown>) =>
    api.download(API_ENDPOINTS.AUDIT_LOGS.EXPORT, { params }),
};
