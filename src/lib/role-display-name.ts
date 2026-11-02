// The name a role is shown by, wherever a screen labels one.
//
// Dependency-free apart from the static catalog, so it is unit-testable under
// `tsx --test`.

import { ROLES } from "@/constants/rbac";
import type { ApiRole } from "@/services/role.service";

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
 * user payload carries role keys, not display names). The matching role in
 * `roles` (from `GET /roles`) supplies its saved display name; without the
 * list, or without a match, it reads as `roleDisplayName()` would with no
 * saved name.
 */
export function roleLabelForKey(
  key: string | null | undefined,
  roles: ReadonlyArray<Pick<ApiRole, "name" | "display_name">> | undefined
): string {
  if (!key) return "";
  const match = roles?.find((r) => r.name === key);
  return roleDisplayName(match ?? { name: key, display_name: null });
}
