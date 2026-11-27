import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";
import { RouteGuard } from "@/components/common/route-guard";
import { OriginationShell } from "./_components/origination-shell";

/**
 * Loan Origination sits behind NEXT_PUBLIC_ENABLE_LOAN_ORIGINATION (off by
 * default until the backend serves /loan-origination), so a direct URL is a
 * soft 404 there, and behind `loan_origination:view` everywhere. The shell and
 * every tab render inside the guard, so nothing is requested for a user it
 * refuses.
 */
export default function LoanOriginationLayout({ children }: { children: ReactNode }) {
  if (!env.features.loanOrigination) notFound();

  return (
    <RouteGuard permission="loan_origination:view" pageName="Loan Origination">
      <OriginationShell>{children}</OriginationShell>
    </RouteGuard>
  );
}
