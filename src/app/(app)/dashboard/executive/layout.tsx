import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** /dashboard/executive is off unless NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD is set at build time. */
export default function ExecutiveDashboardLayout({ children }: { children: ReactNode }) {
  if (!env.features.executiveDashboard) notFound();
  return children;
}
