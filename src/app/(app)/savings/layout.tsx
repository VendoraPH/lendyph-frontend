import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

// Savings & Deposits ships behind NEXT_PUBLIC_ENABLE_SAVINGS. Hiding the
// sidebar entry is not enough: a deployment without the flag must not serve
// /savings/* by direct URL either. The gate sits in this Server Component so
// none of the module's client code is sent when the flag is off (a soft 404,
// as with loans/amortization-binhs).
export default function SavingsLayout({ children }: { children: ReactNode }) {
  if (!env.features.savings) {
    notFound();
  }
  return children;
}
