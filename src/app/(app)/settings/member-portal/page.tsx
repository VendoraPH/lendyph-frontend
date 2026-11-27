"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { PortalSettingsScreen } from "./_components/portal-settings-screen";

export default function MemberPortalSettingsPage() {
  return (
    <RouteGuard permission="member_portal:settings" pageName="Member Portal">
      <PortalSettingsScreen />
    </RouteGuard>
  );
}
