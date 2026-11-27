import { getErrorMessage } from "@/lib/api-error";
import { roleConflictMessage } from "./role-conflict";

/**
 * Roles the API never deactivates (RoleController refuses with a 422), so
 * the roles list offers no activate/deactivate button for them.
 */
const PROTECTED_ROLE_KEYS: readonly string[] = ["super_admin", "admin"];

export function canToggleActive(roleKey: string): boolean {
  return !PROTECTED_ROLE_KEYS.includes(roleKey);
}

/** The mark the roles list shows beside a deactivated role's name, in words. */
export function roleStatusMark(isActive: boolean): string | null {
  return isActive ? null : "Inactive";
}

/**
 * What to show when activating or deactivating a role fails.
 *
 * - 409: the role was deleted meanwhile; show that and reload the list.
 * - 422: the server's reason, e.g. deactivating a role you hold, or
 *   reactivating one that carries a permission you don't hold.
 * - Anything else: the caller's generic message.
 */
export function roleActivationError(err: unknown, fallback: string): { message: string; reload: boolean } {
  const conflict = roleConflictMessage(err);
  if (conflict) return { message: conflict, reload: true };

  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === 422) return { message: getErrorMessage(err, fallback), reload: false };

  return { message: fallback, reload: false };
}
