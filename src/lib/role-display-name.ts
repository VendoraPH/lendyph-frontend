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
