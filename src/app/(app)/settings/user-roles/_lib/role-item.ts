import { ROLES } from "@/constants/rbac";
import type { Permission } from "@/types";
import type { ApiRole } from "@/services/role.service";
import { MODULE_ACTIONS, type UIModule } from "./permission-matrix";

/** A role as the roles screen holds it. */
export interface RoleItem {
  id?: number;
  key: string;
  label: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
}

function titleCase(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * An API role in the screen's shape, with a label from the frontend's catalog
 * when it knows the role.
 *
 * Every permission the role holds is kept, including the ones the matrix does
 * not show: the retired `collections:*`, and grants such as
 * `users:reset_password` or `loans:extend` that have no checkbox. The form
 * edits this set and `PUT /roles/{id}` replaces the role's permissions with
 * exactly what it sends, so anything dropped here is revoked on the next
 * save. Until 2026-09-30 this stripped `collections:*`, and every save of a
 * role revoked them.
 */
export function roleItemFromApi(api: ApiRole): RoleItem {
  const key = api.name;
  const known = (ROLES as Record<string, { label: string; description: string }>)[key];
  return {
    id: api.id,
    key,
    label: known?.label ?? titleCase(key),
    description: api.description ?? known?.description ?? "",
    permissions: api.permissions as Permission[],
    isSystem: api.is_system === true,
    isActive: api.is_active ?? true,
  };
}

/** Tick or untick one permission. Nothing else in the set changes. */
export function togglePermission(
  current: ReadonlySet<Permission>,
  permission: Permission
): Set<Permission> {
  const next = new Set(current);
  if (next.has(permission)) next.delete(permission);
  else next.add(permission);
  return next;
}

/**
 * Grant or revoke every action the matrix offers for one module. A permission
 * the matrix does not offer, in this module or any other, is left as it was.
 */
export function setModulePermissions(
  current: ReadonlySet<Permission>,
  mod: UIModule,
  enable: boolean
): Set<Permission> {
  const next = new Set(current);
  for (const act of MODULE_ACTIONS[mod]) {
    const perm = `${mod}:${act}` as Permission;
    if (enable) next.add(perm);
    else next.delete(perm);
  }
  return next;
}
