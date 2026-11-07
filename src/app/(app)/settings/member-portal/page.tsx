import { notFound } from "next/navigation";
import { RouteGuard } from "@/components/common";
import { env } from "@/config/env";
import { PortalSettingsForm } from "./_components/portal-settings-form";

export default function MemberPortalSettingsPage() {
  if (!env.features.memberPortal) notFound();
  return (
    <RouteGuard permission="member_portal:settings" pageName="Member Portal Settings">
      <PortalSettingsForm />
    </RouteGuard>
  );
}
