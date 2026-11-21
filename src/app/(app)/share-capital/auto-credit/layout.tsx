import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** Auto-Credit is on unless a deployment sets NEXT_PUBLIC_ENABLE_SHARE_CAPITAL_AUTO_CREDIT=false at build time. */
export default function ShareCapitalAutoCreditLayout({ children }: { children: ReactNode }) {
  if (!env.features.shareCapitalAutoCredit) notFound();
  return children;
}
