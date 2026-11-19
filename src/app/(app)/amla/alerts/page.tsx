"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_ALERTS_PERMISSION } from "@/lib/amla/monitoring-access";
import { AlertsList } from "../_components/alerts-list";

export default function AmlaAlertsPage() {
  return (
    <RouteGuard permission={AMLA_ALERTS_PERMISSION} pageName="Alerts">
      <AlertsList />
    </RouteGuard>
  );
}
