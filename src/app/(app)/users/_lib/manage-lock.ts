import type { User } from "@/types";

export const SUPER_ADMIN_LOCK_REASON = "Only a super_admin can change this account.";
export const BRANCH_LOCK_REASON = "This user also works in a branch you don't manage.";
export const PERMISSION_LOCK_REASON = "This user holds permissions you don't have";

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
 * and why. The server's `can_manage` decides when the row carries it (it
 * applies the same rule as those requests, which answer a masked 404). The
 * client's own locks only name the reason when they match, and decide on their
 * own when `can_manage` is missing (an API that hasn't shipped it).
 */
export function userManageLock(user: Pick<User, "can_manage">, client: ClientManageLocks): ManageLock {
  const clientReason = client.superAdminLocked
    ? SUPER_ADMIN_LOCK_REASON
    : client.branchLocked
      ? BRANCH_LOCK_REASON
      : null;

  if (user.can_manage === true) return { locked: false, reason: null };
  if (user.can_manage === false) return { locked: true, reason: clientReason ?? PERMISSION_LOCK_REASON };
  return { locked: clientReason !== null, reason: clientReason };
}
