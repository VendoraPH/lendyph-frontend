import { roleDisplayName } from "@/lib/role-display-name";
import type { ApiRole } from "@/services/role.service";
import type { UpdateUserData } from "@/services/user.service";

/**
 * The roles the user form offers.
 *
 * A deactivated role grants nothing and the API refuses to assign it (422 on
 * `role`), so the picker leaves it out. The one exception is the role the user
 * being edited already holds: they keep it while it's deactivated, and hiding
 * it would make the form look as if they had no role at all. It stays visible
 * and selected, marked inactive.
 *
 * Only an explicit `is_active: false` hides a role; an API that predates the
 * flag sends none, and every role there is active.
 *
 * `super_admin` is the platform team's role, offered only to a caller who holds
 * it (`callerRoles`). The edited user's own role stays shown, as above.
 */
export function roleOptions(
  roles: ApiRole[],
  heldRole?: string,
  callerRoles: readonly string[] = [],
): ApiRole[] {
  const held = (role: ApiRole) => heldRole !== undefined && role.name === heldRole;
  const offerSuperAdmin = callerRoles.includes("super_admin");
  return roles.filter(
    (role) =>
      held(role) || (role.is_active !== false && (role.name !== "super_admin" || offerSuperAdmin)),
  );
}

export function isInactiveRole(role: ApiRole): boolean {
  return role.is_active === false;
}

/**
 * The label the role picker shows: the role's display name, with
 * " (inactive)" after a deactivated one, both on its option and where the
 * selected role is named. Active roles read their name alone.
 */
export function roleOptionLabel(role: ApiRole): string {
  const name = roleDisplayName(role);
  return isInactiveRole(role) ? `${name} (inactive)` : name;
}

/**
 * The edit payload without `role` when it's the role the user already holds.
 *
 * The form posts the whole record back, and the API checks any role it's sent
 * as if it were being handed out. A user whose role was deactivated keeps it,
 * so re-sending it would refuse an edit of their name or email with a 422 on
 * `role`. Leaving it out says nothing about the role, which is the same as
 * not changing it.
 */
export function withoutUnchangedRole(payload: UpdateUserData, heldRole?: string): UpdateUserData {
  if (payload.role === undefined || payload.role !== heldRole) return payload;
  const rest = { ...payload };
  delete rest.role;
  return rest;
}
