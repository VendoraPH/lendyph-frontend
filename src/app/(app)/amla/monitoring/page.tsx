"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { DetectionRulesScreen } from "../_components/detection-rules-screen";

/** The detection rules cover the whole cooperative, so the page needs every branch, as its endpoint does (the layout needs amla:view). */
export default function AmlaMonitoringPage() {
  return (
    <RouteGuard permission="branches:view_all" pageName="Transaction Monitoring">
      <DetectionRulesScreen />
    </RouteGuard>
  );
}
