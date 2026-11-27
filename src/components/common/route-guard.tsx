"use client";

import { usePermission } from "@/hooks";
import { AccessDenied } from "./access-denied";
import { meetsPermission, type PermissionRequirement } from "@/lib/permission-requirement";

interface RouteGuardProps {
  /** One permission, or a list of which the user needs any one. */
  permission: PermissionRequirement;
  pageName?: string;
  children: React.ReactNode;
}

export function RouteGuard({
  permission,
  pageName,
  children,
}: RouteGuardProps) {
  const { can } = usePermission();

  if (!meetsPermission(permission, can)) {
    return <AccessDenied pageName={pageName} />;
  }

  return <>{children}</>;
}
