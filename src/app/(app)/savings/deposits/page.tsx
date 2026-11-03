"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/common";
import { MoneyMovement } from "../_components/money-movement";

export default function SavingsDepositsPage() {
  return (
    <RouteGuard permission="savings:deposit" pageName="Savings Deposits">
      {/* useSearchParams (the ?account= preselect) needs a Suspense boundary. */}
      <Suspense>
        <MoneyMovement mode="deposit" />
      </Suspense>
    </RouteGuard>
  );
}
