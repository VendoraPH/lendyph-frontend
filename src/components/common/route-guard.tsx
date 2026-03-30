"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermission } from "@/hooks";
import type { Permission } from "@/types";

interface RouteGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallbackUrl?: string;
}

export function RouteGuard({
  permission,
  children,
  fallbackUrl = "/dashboard",
}: RouteGuardProps) {
  const { can } = usePermission();
  const router = useRouter();

  useEffect(() => {
    if (!can(permission)) {
      router.replace(fallbackUrl);
    }
  }, [can, permission, router, fallbackUrl]);

  if (!can(permission)) {
    return null;
  }

  return <>{children}</>;
}
