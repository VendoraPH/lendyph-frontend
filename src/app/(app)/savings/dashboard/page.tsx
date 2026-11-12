"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { SavingsDashboardScreen } from "./_components/dashboard-screen";

export default function SavingsDashboardPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Dashboard">
      <SavingsDashboardScreen />
    </RouteGuard>
  );
}
