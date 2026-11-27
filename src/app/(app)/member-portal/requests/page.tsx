"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { RequestsScreen } from "./_components/requests-screen";

export default function PortalRequestsPage() {
  return (
    <RouteGuard permission="member_portal:requests" pageName="Portal Requests">
      <RequestsScreen />
    </RouteGuard>
  );
}
