"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/common";
import { MoneyMovement } from "../_components/money-movement";

export default function SavingsWithdrawalsPage() {
  return (
    <RouteGuard permission="savings:withdraw" pageName="Savings Withdrawals">
      {/* useSearchParams (the ?account= preselect) needs a Suspense boundary. */}
      <Suspense>
        <MoneyMovement mode="withdrawal" />
      </Suspense>
    </RouteGuard>
  );
}
