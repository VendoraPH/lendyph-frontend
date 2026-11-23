"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill } from "@/components/common/page-fill";
import { useApiResource } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaReportApi } from "@/lib/amla/report-api";
import { ComplianceReportView } from "./compliance-report-view";

/**
 * Finds the report in the caller's catalog first: it says whether the report
 * takes a date range, and a report missing from it is one the caller can't
 * open, so it is never requested.
 */
export function ComplianceReportPage({ reportKey }: { reportKey: string }) {
  const [fetcher] = useState(() => once(() => amlaReportApi.catalog()));
  const resource = useApiResource(fetcher);

  return (
    <DataState resource={resource} summary="The AMLA reports you can open." endpoints={["GET /amla/compliance-reports"]}>
      {(reports) => {
        const summary = reports.find((r) => r.key === reportKey);
        if (summary) return <ComplianceReportView summary={summary} />;
        return (
          <PageFill>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Report not available</h1>
              <p className="text-sm text-muted-foreground">This report doesn&apos;t exist, or your role can&apos;t open it.</p>
              <Link href="/amla/reports" className="text-sm underline-offset-4 hover:underline">
                Back to AMLA Reports
              </Link>
            </div>
          </PageFill>
        );
      }}
    </DataState>
  );
}
