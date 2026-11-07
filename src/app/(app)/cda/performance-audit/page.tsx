"use client";

import { RouteGuard } from "@/components/common";
import { ReportWorkspace } from "../_components/report-workspace";

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Performance Audit">
      <ReportWorkspace type="performance_audit" />
    </RouteGuard>
  );
}
