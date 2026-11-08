import type { User } from "@/types";

export const SUPER_ADMIN_LOCK_REASON = "Only a super_admin can change this account.";
export const BRANCH_LOCK_REASON = "This user also works in a branch you don't manage.";
export const PERMISSION_LOCK_REASON = "This user holds permissions you don't have.";

export interface ClientManageLocks {
  /** The target is a super_admin and the caller isn't. */
  superAdminLocked: boolean;
  /** The target also works in a branch the caller doesn't hold (no `branches:view_all`). */
  branchLocked: boolean;
}

export interface ManageLock {
  locked: boolean;
  reason: string | null;
}

/**
 * Whether edit, reset password, deactivate and activate are locked on a row,
 * and why. The client's own locks (super_admin target, a branch the caller
 * doesn't hold) always apply. The server's `can_manage` can only add a lock:
 * `false` (the same rule as those requests, which answer a masked 404, and it
 * also sees permissions the client can't) locks the row, with the client's
 * reason when it has one. `true` or a missing value leaves the client's answer.
 */
export function userManageLock(user: Pick<User, "can_manage">, client: ClientManageLocks): ManageLock {
  const clientReason = client.superAdminLocked
    ? SUPER_ADMIN_LOCK_REASON
    : client.branchLocked
      ? BRANCH_LOCK_REASON
      : null;

  if (user.can_manage === false) return { locked: true, reason: clientReason ?? PERMISSION_LOCK_REASON };
  return { locked: clientReason !== null, reason: clientReason };
}
