import { notFound } from "next/navigation";
import { RouteGuard } from "@/components/common";
import { env } from "@/config/env";
import { PortalAccessScreen } from "./_components/portal-access-screen";

export default function PortalAccessPage() {
  // Behind NEXT_PUBLIC_ENABLE_MEMBER_PORTAL until the backend serves /portal-admin/*.
  if (!env.features.memberPortal) notFound();
  return (
    <RouteGuard permission="member_portal:view" pageName="Portal Access">
      <PortalAccessScreen />
    </RouteGuard>
  );
}
