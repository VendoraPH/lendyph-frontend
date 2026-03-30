"use client";

import { useAuthStore } from "@/store";
import type { Permission, Role } from "@/types";

export function usePermission() {
  const { hasPermission, hasAnyPermission, hasRole, getPermissions, user } =
    useAuthStore();

  return {
    can: (permission: Permission) => hasPermission(permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(permissions),
    canAll: (permissions: Permission[]) =>
      permissions.every((p) => hasPermission(p)),
    isRole: (role: Role) => hasRole(role),
    isAdmin: () => hasRole("admin"),
    permissions: getPermissions(),
    role: user?.role ?? null,
  };
}
