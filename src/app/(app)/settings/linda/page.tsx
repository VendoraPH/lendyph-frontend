"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { LindaSettingsScreen } from "./_components/linda-settings-screen";

/** The settings apply to every branch, so the page needs both, as the server does. */
export default function LindaSettingsPage() {
  return (
    <RouteGuard permission="linda:settings" pageName="Linda">
      <RouteGuard permission="branches:view_all" pageName="Linda">
        <LindaSettingsScreen />
      </RouteGuard>
    </RouteGuard>
  );
}
