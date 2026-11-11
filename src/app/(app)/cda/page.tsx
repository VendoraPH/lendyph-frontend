"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaDashboard } from "@/types/cda";
import { CdaPage } from "./_components/cda-page";
import { OpenPeriodForm } from "./_components/open-period";
import { ReadinessMeter } from "./_components/readiness-meter";
import { ReportTile } from "./_components/report-tile";
import { DeadlineBadge } from "./_components/tone-badge";
import { ValidationPanel } from "./_components/validation-panel";
import { REPORT_PAGES, reportName } from "./_lib/labels";

function Overview({ data }: { data: CdaDashboard }) {
  const next = data.next_deadline;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardDescription>
              {data.readiness_label} · {data.period.year}
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{data.readiness}%</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ReadinessMeter value={data.readiness} critical={data.counts.critical} label="Across the reports that apply" />
            <p className="text-xs text-muted-foreground">
              {data.counts.applicable} of {data.counts.total} reports apply · {data.counts.filed} filed ·{" "}
              {data.counts.critical} critical · {data.counts.warnings} {data.counts.warnings === 1 ? "warning" : "warnings"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Next deadline</CardDescription>
            <CardTitle className="text-xl">{next ? formatDate(next.effective_deadline) : "None to come"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {next ? (
              <>
                <Link href={REPORT_PAGES[next.report_type]?.href ?? "/cda"} className="block text-sm font-medium hover:underline">
                  {reportName(next.report_type, next.part)}
                </Link>
                <DeadlineBadge daysRemaining={next.days_remaining} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Every report that applies is filed or past its deadline.</p>
            )}
            {data.period.extended_deadline && (
              <p className="text-xs text-muted-foreground">
                Annual reports extended by CDA to {formatDate(data.period.extended_deadline)}
                {data.period.extension_reference && ` (${data.period.extension_reference})`}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.reports.map((r) => (
          <ReportTile key={r.id} report={r} />
        ))}
      </div>

      <ValidationPanel
        issues={data.issues}
        critical={data.counts.critical}
        warnings={data.counts.warnings}
        showReport
        title="Open issues across reports"
      />
    </div>
  );
}

function Dashboard({ year }: { year: number }) {
  const resource = useApiResource(useCallback(() => cdaService.getDashboard(year), [year]));
  return (
    <DataState
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.DASHBOARD(year)}`]}
      summary={`Readiness of every ${year} CDA report, the next deadline and open issues`}
    >
      {(data) => <Overview data={data} />}
    </DataState>
  );
}

export default function Page() {
  return (
    <CdaPage
      title="CDA Compliance"
      pageName="CDA Dashboard"
      description="The cooperative's annual CDA reports: readiness, deadlines and what still blocks filing."
      actions={(ctx) =>
        ctx && (
          <PermissionGate permission="cda:prepare">
            <OpenPeriodForm compact onOpened={ctx.reloadPeriods} />
          </PermissionGate>
        )
      }
      noPeriod={(reload) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No reporting period is open yet</CardTitle>
            <CardDescription>
              Opening a year creates its CDA reports, each with its template and deadline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OpenPeriodForm onOpened={reload} />
          </CardContent>
        </Card>
      )}
    >
      {(ctx) => ctx && <Dashboard key={ctx.year} year={ctx.year} />}
    </CdaPage>
  );
}
