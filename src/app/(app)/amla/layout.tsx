import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { env } from "@/config/env";
import { AMLA_ROUTE_PERMISSION } from "@/lib/amla/access";

/**
 * AMLA Compliance is off unless NEXT_PUBLIC_ENABLE_AMLA is set at build time,
 * and every page under it needs `amla:view`, as the server's AMLA routes do
 * (`amlaRouteDecision`). Pages that need more guard on it themselves.
 */
export default function AmlaLayout({ children }: { children: ReactNode }) {
  if (!env.features.amla) notFound();
  return (
    <RouteGuard permission={AMLA_ROUTE_PERMISSION} pageName="AMLA Compliance">
      {children}
    </RouteGuard>
  );
}
