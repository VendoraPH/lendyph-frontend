"use client";

import { useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
import { roleLabelForKey } from "@/lib/role-display-name";
import { roleService, type ApiRole } from "@/services/role.service";
import { usePermission } from "./use-permission";

/**
 * The label for a role key, by its saved display name when one is set.
 *
 * The user payload carries role keys only, so the display name comes from
 * `GET /roles`, which needs `users:view`. Without that permission, or while the
 * list loads or if it fails, the role reads by its catalog label.
 */
export function useRoleLabel(key: string | null | undefined): string {
  const { can } = usePermission();
  const canListRoles = can("users:view");
  const [roles, setRoles] = useState<ApiRole[] | undefined>(undefined);

  useEffect(() => {
    if (!key || !canListRoles) return;
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
  }, [key, canListRoles]);

  return roleLabelForKey(key, canListRoles ? roles : undefined);
}
