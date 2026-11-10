"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { SettingsScreen } from "./_components/settings-screen";

export default function SavingsSettingsPage() {
  return (
    <RouteGuard permission={["savings:settings", "savings:view"]} pageName="Savings Settings">
      <SettingsScreen />
    </RouteGuard>
  );
}
