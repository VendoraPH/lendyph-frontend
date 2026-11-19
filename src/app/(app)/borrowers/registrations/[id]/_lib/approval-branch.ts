/**
 * The branch a registration is approved into (Phase 6, D7). Pure, so it runs
 * under `tsx --test`.
 *
 * The server refuses to approve a registration without a branch, and never
 * moves one to another branch on approval (both 422 on `branch_id`). So a
 * registration that names a branch is approved there, and one with none needs
 * the reviewer to pick one of their own branches (all of them with
 * `branches:view_all`; `branchPicker` decides which are offered).
 */

/** The server's own words for a missing branch, shown before it is asked. */
export const APPROVAL_BRANCH_REQUIRED =
  "Choose the branch this member belongs to before approving the registration.";

export interface ApprovalBranch {
  /** True when the registration already names its branch, which approval keeps. */
  fixed: boolean;
  /** The branch the approval sends, or null while none is chosen. */
  branchId: number | null;
}

export function approvalBranch(
  registrationBranchId: number | null | undefined,
  offered: readonly { id: number }[],
  picked: number | null,
): ApprovalBranch {
  if (registrationBranchId != null) return { fixed: true, branchId: registrationBranchId };
  if (picked !== null && offered.some((b) => b.id === picked)) return { fixed: false, branchId: picked };
  return { fixed: false, branchId: offered.length === 1 ? offered[0].id : null };
}

/** The approval's body: the branch, or nothing so the server says what's missing. */
export function approvalPayload(branchId: number | null): { branch_id?: number } {
  return branchId === null ? {} : { branch_id: branchId };
}

/** The server's refusal of the branch, in its own words, or null for any other error. */
export function approvalBranchError(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const errors = (err as { response?: { data?: { errors?: Record<string, unknown> } } }).response?.data?.errors;
  const messages = errors?.branch_id;
  const first = Array.isArray(messages) ? messages[0] : null;
  return typeof first === "string" && first.length > 0 ? first : null;
}
