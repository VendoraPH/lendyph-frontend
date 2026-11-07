import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** Savings & Deposits is off unless NEXT_PUBLIC_ENABLE_SAVINGS is set at build time. */
export default function SavingsLayout({ children }: { children: ReactNode }) {
  if (!env.features.savings) notFound();
  return children;
}
