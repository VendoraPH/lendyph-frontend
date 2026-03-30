"use client";

import { usePermission } from "@/hooks";
import type { Permission, Role } from "@/types";

interface PermissionGateProps {
  permission?: Permission;
  permissions?: Permission[];
  role?: Role;
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  permissions,
  role,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll, isRole } = usePermission();

  let hasAccess = true;

  if (role) {
    hasAccess = isRole(role);
  } else if (permission) {
    hasAccess = can(permission);
  } else if (permissions) {
    hasAccess = requireAll ? canAll(permissions) : canAny(permissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
