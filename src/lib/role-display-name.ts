// The name a role is shown by, wherever a screen labels one.
//
// Dependency-free apart from the static catalog, so it is unit-testable under
// `tsx --test`.

import { ROLES } from "@/constants/rbac";
import type { ApiRole } from "@/services/role.service";
import type { UserRoleDetail } from "@/types";

function titleCase(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * A role's saved `display_name`, then the frontend catalog's label, then the
 * key title-cased. The key itself never changes; the display name is what an
 * admin renames.
 */
export function roleDisplayName(role: Pick<ApiRole, "name" | "display_name">): string {
  const saved = role.display_name?.trim();
  if (saved) return saved;
  const known = (ROLES as Record<string, { label: string }>)[role.name];
  return known?.label ?? titleCase(role.name);
}

/**
 * The label for a role known only by its key, as on the signed-in user (the
 * user's `roles` carry keys, not display names).
 *
 * - The signed-in user's own `role_details` (from `GET /auth/me`, readable
 *   without `users:view`) supply the saved display name first.
 * - Then the matching role in `roles` (from `GET /roles`).
 * - Without either, or without a saved name, it reads as `roleDisplayName()`
 *   would with no saved name.
 */
export function roleLabelForKey(
  key: string | null | undefined,
  roles: ReadonlyArray<Pick<ApiRole, "name" | "display_name">> | undefined,
  ownRoles?: ReadonlyArray<UserRoleDetail> | null
): string {
  if (!key) return "";
  const own = ownRoles?.find((r) => (r.key ?? r.name) === key)?.display_name?.trim();
  if (own) return own;
  const match = roles?.find((r) => r.name === key);
  return roleDisplayName(match ?? { name: key, display_name: null });
}

/**
 * A role the server names for us (`role_label` on an approval step or the
 * forward candidates' next step). The server sends the saved display name, or,
 * with none saved, the key run through `Str::headline` ("bod1" reads "Bod1").
 * That fallback is the key title-cased, so it is replaced by the screen's own
 * name for the role ("BOD1"), the one every other screen shows; a saved
 * display name is kept as sent.
 */
export function roleLabelFromServer(
  key: string | null | undefined,
  serverLabel: string | null | undefined
): string {
  const sent = serverLabel?.trim() ?? "";
  if (!key) return sent;
  if (sent && sent.toLowerCase() !== titleCase(key).toLowerCase()) return sent;
  return roleDisplayName({ name: key, display_name: null });
}
