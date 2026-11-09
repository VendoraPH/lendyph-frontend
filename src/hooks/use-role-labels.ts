"use client";

import { useCallback, useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
import { roleLabelForKey } from "@/lib/role-display-name";
import { roleService, type ApiRole } from "@/services/role.service";
import { usePermission } from "./use-permission";

/**
 * A labeller for role keys, by each role's saved display name: for screens
 * that name several roles (an approval step's role, the signed-in user's
 * roles). `useRoleLabel` does the same for one key.
 *
 * The display names come from `GET /roles`, which needs `users:view`, read
 * once. Without that permission, or while the list loads or if it fails, a
 * role reads by its catalog label, never its key.
 */
export function useRoleLabels(): (key: string | null | undefined) => string {
  const { can } = usePermission();
  const canListRoles = can("users:view");
  const [roles, setRoles] = useState<ApiRole[] | undefined>(undefined);

  useEffect(() => {
    if (!canListRoles) return;
    let cancelled = false;
    roleService
      .listAll()
      .then(completeRows)
      .then((rows) => {
        if (!cancelled) setRoles(rows);
      })
      .catch(() => {
        // Fails soft: the catalog label is still a correct name for the role.
      });
    return () => {
      cancelled = true;
    };
  }, [canListRoles]);

  const known = canListRoles ? roles : undefined;
  return useCallback((key: string | null | undefined) => roleLabelForKey(key, known), [known]);
}
