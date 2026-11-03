"use client";

import { usePermission } from "@/hooks";
import { AccessDenied } from "./access-denied";
import type { Permission } from "@/types";

interface RouteGuardProps {
  /** One permission, or several of which the user needs any one. */
  permission: Permission | Permission[];
  pageName?: string;
  children: React.ReactNode;
}

export function RouteGuard({
  permission,
  pageName,
  children,
}: RouteGuardProps) {
  const { can, canAny } = usePermission();
  const allowed = Array.isArray(permission) ? canAny(permission) : can(permission);

  if (!allowed) {
    return <AccessDenied pageName={pageName} />;
  }

  return <>{children}</>;
}
