"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { PortalAccessScreen } from "./_components/portal-access-screen";

export default function PortalAccessPage() {
  return (
    <RouteGuard permission="member_portal:view" pageName="Portal Access">
      <PortalAccessScreen />
    </RouteGuard>
  );
}
