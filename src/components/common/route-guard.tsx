"use client";

import { usePermission } from "@/hooks";
import { AccessDenied } from "./access-denied";
import type { Permission } from "@/types";

interface RouteGuardProps {
  permission: Permission;
  pageName?: string;
  children: React.ReactNode;
}

export function RouteGuard({
  permission,
  pageName,
  children,
}: RouteGuardProps) {
  const { can } = usePermission();

  if (!can(permission)) {
    return <AccessDenied pageName={pageName} />;
  }

  return <>{children}</>;
}
