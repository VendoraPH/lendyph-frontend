"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AnnouncementsScreen } from "./_components/announcements-screen";

export default function PortalAnnouncementsPage() {
  return (
    <RouteGuard permission="member_portal:announcements" pageName="Portal Announcements">
      <AnnouncementsScreen />
    </RouteGuard>
  );
}
