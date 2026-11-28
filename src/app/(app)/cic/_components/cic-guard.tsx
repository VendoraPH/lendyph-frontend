"use client";

import type { ReactNode } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import type { Permission } from "@/types";

/**
 * Every CIC page's guard: `branches:view_all` (the file covers every member and
 * loan of the cooperative, not one branch's) and the page's own `cic:*`
 * permission. Each guard only swaps its children, so nothing inside asks the
 * server for anything until the user holds both.
 */
export function CicGuard({
  permission,
  pageName,
  children,
}: {
  permission: Permission;
  pageName: string;
  children: ReactNode;
}) {
  return (
    <RouteGuard permission="branches:view_all" pageName={pageName}>
      <RouteGuard permission={permission} pageName={pageName}>
        {children}
      </RouteGuard>
    </RouteGuard>
  );
}
