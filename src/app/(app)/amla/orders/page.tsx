"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_SANCTIONS_PERMISSION } from "@/lib/amla/screening-access";
import { OrdersList } from "./_components/orders-list";

/** The orders register covers the whole cooperative, so it needs every branch as well, as its endpoints do. */
export default function AmlaOrdersPage() {
  return (
    <RouteGuard permission={AMLA_SANCTIONS_PERMISSION} pageName="Orders Register">
      <RouteGuard permission="branches:view_all" pageName="Orders Register">
        <OrdersList />
      </RouteGuard>
    </RouteGuard>
  );
}
