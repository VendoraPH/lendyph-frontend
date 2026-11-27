"use client";

import type { ReactNode } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import type { Permission } from "@/types";

/**
 * Every CDA page's guard: `branches:view_all` (CDA reports cover the whole
 * cooperative), `cda:view`, and the restricted view a mediation, audit or tax
 * page needs. Each guard only swaps its children, so nothing inside asks the
 * server for anything until the user holds all of them.
 */
export function CdaGuard({
  pageName,
  restriction = null,
  children,
}: {
  pageName: string;
  restriction?: Permission | null;
  children: ReactNode;
}) {
  return (
    <RouteGuard permission="branches:view_all" pageName={pageName}>
      <RouteGuard permission="cda:view" pageName={pageName}>
        {restriction ? (
          <RouteGuard permission={restriction} pageName={pageName}>
            {children}
          </RouteGuard>
        ) : (
          children
        )}
      </RouteGuard>
    </RouteGuard>
  );
}
