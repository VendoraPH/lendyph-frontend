import { ROLES } from "@/constants/rbac";
import type { Permission } from "@/types";
import type { ApiRole, RolePayload } from "@/services/role.service";
import { roleDisplayName } from "@/lib/role-display-name";
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

/** A role name typed by an admin, as the lowercase key the API stores. */
export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * An API role in the screen's shape, labelled by `roleDisplayName()`.
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
    label: roleDisplayName(api),
    description: api.description ?? known?.description ?? "",
    permissions: api.permissions as Permission[],
    isSystem: api.is_system === true,
    isActive: api.is_active ?? true,
  };
}

/**
 * The body `POST /roles` (create) or `PUT /roles/{id}` (edit) is sent.
 *
 * An edit never sends `name`: the key is what permission checks use, so a
 * rename only changes `display_name`. A create sends both, the key slugged
 * from the label.
 */
export function rolePayload(item: RoleItem, { isEdit }: { isEdit: boolean }): RolePayload {
  const common = {
    display_name: item.label,
    description: item.description,
    permissions: item.permissions,
  };
  return isEdit ? common : { name: slugify(item.label), ...common };
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
