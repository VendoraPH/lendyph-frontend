import { notFound } from "next/navigation";
import { RouteGuard } from "@/components/common";
import { env } from "@/config/env";
import { PortalRequestsScreen } from "./_components/portal-requests-screen";

export default function PortalRequestsPage() {
  // Behind NEXT_PUBLIC_ENABLE_MEMBER_PORTAL until the backend serves /portal-admin/*.
  if (!env.features.memberPortal) notFound();
  return (
    <RouteGuard permission="member_portal:manage" pageName="Portal Requests">
      <PortalRequestsScreen />
    </RouteGuard>
  );
}
