"use client";

import { Info } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { ReportWorkspace } from "../_components/report-workspace";

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="ATIR & ABR">
      <ReportWorkspace type="atir_abr">
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          The Annual Tax Incentives Report and Annual Benefits Report apply to cooperatives holding a Certificate of
          Tax Exemption. Set the CTE status in CDA Settings; without one, the dashboard marks this report not
          applicable.
        </p>
      </ReportWorkspace>
    </RouteGuard>
  );
}
