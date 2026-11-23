// The Audit Trail's filters as the server reads them, for the list and the
// CSV alike, so the file always matches the screen. `buildQuery()` in
// AuditLogController reads `search`, `module`, `action`, `date_from`,
// `date_to` and, since Phase 6 MB-BE6, `branch_id`: the audited record's
// branch, which only rows written since then carry.

import { ALL_BRANCHES, branchIdParam } from "@/lib/branch-filter";

export interface AuditFilters {
  search: string;
  /** A module, or "all". */
  module: string;
  /** An action, or "all". */
  action: string;
  dateFrom: string | null;
  dateTo: string | null;
  /** The shared branch filter's value: `ALL_BRANCHES` or a branch id as text. */
  branch: string;
}

/** Shown under a picked branch, so a shorter list doesn't read as missing events. */
export const AUDIT_BRANCH_NOTE =
  "Events recorded before the audit trail kept a branch have none, so a branch filter leaves them out.";

/**
 * Whether the Branch filter shows. The filter needs `branches:view_all`, as
 * the Audit Trail itself does (the server answers 403 without it).
 */
export function auditBranchFilterShown(viewAll: boolean): boolean {
  return viewAll;
}

/** The filters the CSV export sends: the list's, with no page. */
export function auditExportParams(filters: AuditFilters, viewAll: boolean): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.search) params.search = filters.search;
  if (filters.action !== "all") params.action = filters.action;
  if (filters.module !== "all") params.module = filters.module;
  // Whole-day bounds on `created_at`, sent as the calendar strings themselves.
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  const branchId = auditBranchFilterShown(viewAll) ? branchIdParam(filters.branch) : undefined;
  if (branchId !== undefined) params.branch_id = branchId;
  return params;
}

/** The list's query: the export's filters plus the page. */
export function auditListParams(
  filters: AuditFilters,
  viewAll: boolean,
  page: number,
  perPage: number,
): Record<string, unknown> {
  return { ...auditExportParams(filters, viewAll), page, per_page: perPage };
}

/** Whether any filter is set, the branch included. */
export function auditFiltersActive(filters: AuditFilters): boolean {
  return (
    filters.search !== "" ||
    filters.module !== "all" ||
    filters.action !== "all" ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.branch !== ALL_BRANCHES
  );
}
