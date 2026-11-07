"use client";

import { RouteGuard } from "@/components/common";
import { ReportWorkspace } from "../_components/report-workspace";

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Sworn Statement">
      <ReportWorkspace type="sworn_statement" />
    </RouteGuard>
  );
}
