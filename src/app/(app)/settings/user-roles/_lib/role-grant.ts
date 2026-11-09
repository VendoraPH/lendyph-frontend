import type { Action, Permission } from "@/types";
import { moduleToggleActions, type UIModule } from "./permission-matrix";

/** The signed-in user, as far as granting permissions goes. */
export interface GrantingCaller {
  roles: readonly string[];
  permissions: readonly string[];
}

/**
 * Why an unticked box is locked. The API refuses a role save that adds a
 * permission the caller doesn't hold, unless the caller is a super_admin.
 */
export const GRANT_LOCK_REASON = "You can only grant permissions you hold";

/** Why Edit is locked on the super_admin row: only a super_admin may change it. */
export const SUPER_ADMIN_EDIT_REASON = "Only a super admin can edit this role";

function isSuperAdmin(caller: GrantingCaller): boolean {
  return caller.roles.includes("super_admin");
}

/** Whether the caller may add this permission to a role. */
export function canGrant(caller: GrantingCaller, permission: string): boolean {
  return isSuperAdmin(caller) || caller.permissions.includes(permission);
}

/**
 * The reason a permission's box is locked, or null. Only an unticked box locks:
 * removing a permission is always allowed.
 */
export function grantLockReason(caller: GrantingCaller, permission: string, granted: boolean): string | null {
  return granted || canGrant(caller, permission) ? null : GRANT_LOCK_REASON;
}

/**
 * The actions a module's toggle-all works on for this caller: those it covers
 * that the role already has or the caller can grant. With none, it's locked.
 */
export function moduleToggleTargets(
  mod: UIModule,
  current: ReadonlySet<Permission>,
  caller: GrantingCaller,
): Action[] {
  return moduleToggleActions(mod).filter((act) => {
    const permission = `${mod}:${act}` as Permission;
    return current.has(permission) || canGrant(caller, permission);
  });
}

/** The reason Edit is locked on a role's row, or null. */
export function editLockReason(roleKey: string, caller: GrantingCaller): string | null {
  return roleKey === "super_admin" && !isSuperAdmin(caller) ? SUPER_ADMIN_EDIT_REASON : null;
}
