"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaReportApi } from "@/lib/amla/report-api";

/**
 * AMLA Reports: the reports the caller may open, as the server lists them
 * (each report needs its own key; some also need head-office access).
 */
export function ComplianceReportCatalog() {
  const [fetcher] = useState(() => once(() => amlaReportApi.catalog()));
  const resource = useApiResource(fetcher);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">AMLA Reports</h1>
        <p className="text-sm text-muted-foreground">
          Compliance reports built by the server from the AMLA records. Each one you open or export is logged.
        </p>
      </div>
      <ScrollBox className="p-px">
        <DataState
          resource={resource}
          summary="The AMLA reports you can open."
          endpoints={["GET /amla/compliance-reports"]}
          isEmpty={(reports) => reports.length === 0}
          emptyMessage="Your role can't open any AMLA report."
        >
          {(reports) => (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reports.map((report) => (
                <li key={report.key}>
                  <Link href={`/amla/reports/${encodeURIComponent(report.key)}`} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <Card className="h-full transition-colors hover:bg-muted/40">
                      <CardHeader className="space-y-2">
                        <CardTitle className="text-base">{report.title}</CardTitle>
                        <CardDescription>{report.description}</CardDescription>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{report.uses_period ? "Date range" : "As of today"}</Badge>
                          {report.head_office && <Badge variant="secondary">Head office</Badge>}
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </ScrollBox>
    </PageFill>
  );
}
