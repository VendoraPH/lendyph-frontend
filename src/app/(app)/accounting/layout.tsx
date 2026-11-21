import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** Accounting is on unless a deployment sets NEXT_PUBLIC_ENABLE_ACCOUNTING=false at build time. */
export default function AccountingLayout({ children }: { children: ReactNode }) {
  if (!env.features.accounting) notFound();
  return children;
}
