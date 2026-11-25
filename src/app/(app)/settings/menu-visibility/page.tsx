"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { MenuVisibilityScreen } from "./_components/menu-visibility-screen";

/** Settings → Menu Visibility: `menu_visibility:manage`, then the administrator password. */
export default function MenuVisibilityPage() {
  return (
    <RouteGuard permission="menu_visibility:manage" pageName="Menu Visibility">
      <MenuVisibilityScreen />
    </RouteGuard>
  );
}
