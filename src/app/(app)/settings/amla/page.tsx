"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_SETTINGS_PAGE_PERMISSIONS } from "@/lib/amla/access";
import { AmlaSettingsScreen } from "./_components/amla-settings-screen";

/** Opens for any AMLA key one of its parts needs; each part checks its own, as the server does. */
export default function AmlaSettingsPage() {
  return (
    <RouteGuard permission={[...AMLA_SETTINGS_PAGE_PERMISSIONS]} pageName="AMLA">
      <AmlaSettingsScreen />
    </RouteGuard>
  );
}
