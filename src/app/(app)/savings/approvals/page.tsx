"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { ApprovalsScreen } from "./_components/approvals-screen";

export default function SavingsApprovalsPage() {
  return (
    <RouteGuard permission={["savings:approve", "savings:view"]} pageName="Savings Approvals">
      <ApprovalsScreen />
    </RouteGuard>
  );
}
