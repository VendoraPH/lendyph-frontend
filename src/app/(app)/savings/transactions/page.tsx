"use client";

import { Suspense } from "react";
import { PageLoader } from "@/components/common/page-fill";
import { RouteGuard } from "@/components/common/route-guard";
import { RegisterScreen } from "./_components/register-screen";

export default function SavingsTransactionsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Transactions">
      {/* The screen reads `?view=` (the dashboard's link to the missing references). */}
      <Suspense fallback={<PageLoader />}>
        <RegisterScreen />
      </Suspense>
    </RouteGuard>
  );
}
