"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { RegisterScreen } from "./_components/register-screen";

export default function SavingsTransactionsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Transactions">
      <RegisterScreen />
    </RouteGuard>
  );
}
