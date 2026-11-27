"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AccountsScreen } from "./_components/accounts-screen";

export default function SavingsAccountsPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Accounts">
      <AccountsScreen />
    </RouteGuard>
  );
}
