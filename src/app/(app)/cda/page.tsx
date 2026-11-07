"use client";

import { useCallback, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaDashboard } from "@/types/cda";
import { CdaPageHeader } from "./_components/cda-page-header";
import { ReadinessMeter } from "./_components/readiness-meter";
import { ReportSummaryCard } from "./_components/report-summary-card";
import { ToneBadge } from "./_components/tone-badge";
import { ValidationPanel } from "./_components/validation-panel";
import { useCdaYear } from "./_hooks/use-cda-year";
import { daysUntil, deadlineState, describeDaysLeft, effectiveDeadline } from "./_lib/deadline";
import { DEADLINE_TONE } from "./_lib/labels";
import { isFiled } from "./_lib/workflow";

function Overview({ data }: { data: CdaDashboard }) {
  const applicable = data.reports.filter((r) => r.applicable);
  const critical = applicable.reduce((n, r) => n + r.critical, 0);
  const deadline = effectiveDeadline(data.period);
  const days = daysUntil(deadline, todayISO());
  const state = deadlineState(days, applicable.length > 0 && applicable.every((r) => isFiled(r.status)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardDescription>Lendy CDA Readiness · FY {data.period.year}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{Math.round(data.readiness)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadinessMeter value={data.readiness} critical={critical} label="All applicable reports" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Filing deadline</CardDescription>
            <CardTitle className="text-xl">{formatDate(deadline)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ToneBadge tone={DEADLINE_TONE[state]} label={state === "done" ? "All filed" : describeDaysLeft(days)} />
            {data.period.extended_deadline && (
              <p className="text-xs text-muted-foreground">
                Extended by CDA from {formatDate(data.period.default_deadline)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.reports.map((r) => (
          <ReportSummaryCard key={r.type} summary={r} />
        ))}
      </div>

      <ValidationPanel issues={data.issues} showReport title="Open issues across reports" />
    </div>
  );
}

function Dashboard() {
  const year = useCdaYear();
  const resource = useApiResource(useCallback(() => cdaService.getDashboard(year), [year]));
  const [opening, setOpening] = useState(false);

  function openPeriod() {
    setOpening(true);
    cdaService
      .openPeriod(year)
      .then(() => {
        notifySuccess(`FY ${year} reporting period opened`);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, "Could not open the reporting period"))
      .finally(() => setOpening(false));
  }

  return (
    <div className="space-y-6">
      <CdaPageHeader
        title="CDA Compliance"
        description="Annual CDA reports for the cooperative: readiness, deadlines and what still blocks filing."
        actions={
          resource.data === null && !resource.loading ? (
            <PermissionButton permission="cda:prepare" size="sm" onClick={openPeriod} disabled={opening}>
              <CalendarPlus className="mr-1 h-4 w-4" />
              {opening ? "Opening…" : `Open FY ${year}`}
            </PermissionButton>
          ) : null
        }
      />
      <DataState
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.DASHBOARD(year)}`, `POST ${API_ENDPOINTS.CDA.PERIODS}`]}
        summary={`Readiness of every FY ${year} CDA report, the deadline and open issues`}
      >
        {(data) => <Overview data={data} />}
      </DataState>
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="CDA Compliance">
      <Dashboard />
    </RouteGuard>
  );
}
