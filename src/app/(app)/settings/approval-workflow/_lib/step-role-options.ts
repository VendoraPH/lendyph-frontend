// The Required Role picker's options. Only active roles can be picked, but a
// step saved on a role that has since been deactivated (or is missing from the
// list) still needs a label in the trigger, so it is added, disabled, under its
// name rather than its key.
//
// Dependency-free apart from the role label helpers, so it is unit-testable
// under `tsx --test`.

import { roleDisplayName, roleLabelForKey } from "@/lib/role-display-name";
import type { ApiRole } from "@/services/role.service";

export interface StepRoleOption {
  value: string;
  label: string;
  disabled: boolean;
}

export function stepRoleOptions(
  roles: ReadonlyArray<ApiRole>,
  currentRole: string | null | undefined,
): StepRoleOption[] {
  const options: StepRoleOption[] = roles
    .filter((r) => r.is_active !== false)
    .map((r) => ({ value: r.name, label: roleDisplayName(r), disabled: false }));

  if (!currentRole || options.some((o) => o.value === currentRole)) return options;

  const inactive = roles.find((r) => r.name === currentRole);
  options.push({
    value: currentRole,
    label: inactive
      ? `${roleDisplayName(inactive)} (inactive)`
      : roleLabelForKey(currentRole, roles),
    disabled: true,
  });
  return options;
}
