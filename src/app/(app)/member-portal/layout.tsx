import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** The Member Portal's staff screens are off unless NEXT_PUBLIC_ENABLE_MEMBER_PORTAL is set at build time. */
export default function MemberPortalStaffLayout({ children }: { children: ReactNode }) {
  if (!env.features.memberPortal) notFound();
  return children;
}
