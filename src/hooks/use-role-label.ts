"use client";

import { useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
import { roleLabelForKey } from "@/lib/role-display-name";
import { roleService, type ApiRole } from "@/services/role.service";
import { useAuthStore } from "@/store";
import { usePermission } from "./use-permission";

/**
 * The label for a role key, by its saved display name when one is set.
 *
 * The signed-in user's own roles come with their display names from
 * `GET /auth/me` (`role_details`). Any other name comes from `GET /roles`,
 * which needs `users:view`. Without either, or while the list loads or if it
 * fails, the role reads by its catalog label.
 */
export function useRoleLabel(key: string | null | undefined): string {
  const { can } = usePermission();
  const canListRoles = can("users:view");
  const ownRoles = useAuthStore((state) => state.user?.role_details);
  const ownKeys = useAuthStore((state) => state.user?.roles);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [roles, setRoles] = useState<ApiRole[] | undefined>(undefined);

  // A session signed in from the login response has no `role_details` (only
  // `GET /auth/me` sends them), so the user's own role would read as its key.
  // Ask for them once when this label is the user's own role and there is no
  // other way to its saved name.
  const needsOwnDetails = !!key && !canListRoles && ownRoles === undefined && (ownKeys ?? []).includes(key);
  useEffect(() => {
    if (needsOwnDetails) void refreshUser();
  }, [needsOwnDetails, refreshUser]);

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

  return roleLabelForKey(key, canListRoles ? roles : undefined, ownRoles);
}
