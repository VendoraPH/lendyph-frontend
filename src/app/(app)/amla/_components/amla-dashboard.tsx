"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { amlaApi } from "@/lib/amla/api";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaAlertRow, amlaCtrRow } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import { amlaStatusLines } from "@/lib/amla/settings-view";
import type { AmlaPageMeta } from "@/types/amla";

const SHORT = 10;

/**
 * The AMLA dashboard. The server has no counts endpoint yet (AMLA-B7 brings
 * KPIs and charts), so it shows the monitoring status and the latest open
 * alerts and CTR candidates, each with the total the server's list sends.
 * Nothing is counted here, and each part reads once.
 */
export function AmlaDashboard() {
  const { can } = usePermission();
  const access = amlaMonitoringAccess(can);
  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">AMLA Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Monitoring at a glance. Counts by priority and charts come with the AMLA reports; until then the lists below give
          the server&apos;s totals.
        </p>
      </div>
      <ScrollBox className="space-y-4 p-px">
        {access.status && <StatusCard />}
        <div className="grid gap-4 xl:grid-cols-2">
          {access.alerts && <OpenAlertsCard />}
          {access.ctr && <CtrCard />}
        </div>
      </ScrollBox>
    </PageFill>
  );
}

/** "12 in all" from the server's page meta, never from the rows received. */
function totalText(meta: AmlaPageMeta, noun: string): string {
  return meta.total === 0 ? `No ${noun}.` : `${meta.total} ${noun} in all; the latest ${SHORT} at most are shown.`;
}

function StatusCard() {
  const [fetcher] = useState(() => once(() => amlaApi.status()));
  const resource = useApiResource(fetcher);
  return (
    <DataState resource={resource} summary="Whether AMLA monitoring is on." endpoints={["GET /amla/status"]}>
      {(status) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {amlaStatusLines(status).map((line) => (
                <div key={line.label}>
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className="font-medium">{line.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </DataState>
  );
}

function OpenAlertsCard() {
  const [fetcher] = useState(() =>
    once(() => amlaMonitoringApi.alerts({ status: "open", rule: "", priority: "", from: "", to: "", search: "", page: 1, per_page: SHORT })),
  );
  const resource = useApiResource(fetcher);
  return (
    <DataState resource={resource} summary="The latest open alerts." endpoints={["GET /amla/alerts"]}>
      {(page) => (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base">Open alerts</CardTitle>
              <CardDescription>{totalText(page.meta, "open alerts")}</CardDescription>
            </div>
            <Link href="/amla/alerts" className="text-sm whitespace-nowrap underline-offset-4 hover:underline">
              All alerts
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {page.data.map(amlaAlertRow).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <span>
                    <Link href={row.href} className="font-medium underline-offset-4 hover:underline">
                      {row.reference}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      {row.rule} · {row.subject} · {row.branch}
                    </span>
                  </span>
                  <Badge variant={row.tone}>{row.priority}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </DataState>
  );
}

function CtrCard() {
  const [fetcher] = useState(() => once(() => amlaMonitoringApi.ctrCandidates({ from: "", to: "", search: "", page: 1, per_page: SHORT })));
  const resource = useApiResource(fetcher);
  return (
    <DataState resource={resource} summary="The latest CTR candidates." endpoints={["GET /amla/ctr-candidates"]}>
      {(page) => (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base">CTR candidates</CardTitle>
              <CardDescription>{totalText(page.meta, "CTR candidates")}</CardDescription>
            </div>
            <Link href="/amla/ctr-candidates" className="text-sm whitespace-nowrap underline-offset-4 hover:underline">
              All candidates
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {page.data.map(amlaCtrRow).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <span>
                    <Link href={row.href} className="font-medium underline-offset-4 hover:underline">
                      {row.reference}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      {row.date} · {row.subject} · {row.branch}
                    </span>
                  </span>
                  <span className="whitespace-nowrap">{row.amount}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </DataState>
  );
}
