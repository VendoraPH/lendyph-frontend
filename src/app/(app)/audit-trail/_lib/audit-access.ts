import { httpStatusOf } from "@/lib/api-error";

/**
 * Audit logs need `branches:view_all` as well as `audit_logs:view` (round m6,
 * wave 2): their rows span every branch. The API answers 403 without it.
 */
export const AUDIT_BRANCH_RESTRICTION = "The Audit Trail needs access to every branch.";

/** Why this user can't list audit logs, or null. Checked before any request. */
export function auditTrailRestriction(canViewAllBranches: boolean): string | null {
  return canViewAllBranches ? null : AUDIT_BRANCH_RESTRICTION;
}

/** A 403 from the audit log list, read as the same restriction; null otherwise. */
export function auditLoadRestriction(err: unknown): string | null {
  return httpStatusOf(err) === 403 ? AUDIT_BRANCH_RESTRICTION : null;
}
