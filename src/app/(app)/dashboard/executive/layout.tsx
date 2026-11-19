import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";
import { RouteGuard } from "@/components/common/route-guard";
import { EXECUTIVE_DASHBOARD_PERMISSION } from "../_lib/executive-access";

/**
 * /dashboard/executive is off unless NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD is
 * set at build time, and needs `dashboard:analytics` everywhere. The page
 * renders inside the guard, so nothing is requested for a user it refuses.
 */
export default function ExecutiveDashboardLayout({ children }: { children: ReactNode }) {
  if (!env.features.executiveDashboard) notFound();

  return (
    <RouteGuard permission={EXECUTIVE_DASHBOARD_PERMISSION} pageName="Executive Dashboard">
      {children}
    </RouteGuard>
  );
}
