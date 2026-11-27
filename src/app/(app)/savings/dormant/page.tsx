"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { DormantScreen } from "./_components/dormant-screen";

// The lists come from the dormant savings report, which needs reports:view as well as savings:view.
export default function DormantAccountsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Dormant Accounts">
      <RouteGuard permission="reports:view" pageName="Dormant Accounts">
        <DormantScreen />
      </RouteGuard>
    </RouteGuard>
  );
}
