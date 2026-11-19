"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaAlertLines, amlaAlertRow, amlaAlertWithRow } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import type { AmlaAlertDetail, AmlaAlertRow } from "@/types/amla-monitoring";
import { AlertCaseLine } from "./alert-escalate";
import { AlertHistoryCard, AlertWorkflow } from "./alert-workflow";
import { TransactionsTable } from "./transactions-table";

/**
 * One alert: the rule and the version it cites, why it was raised, its
 * indicators and every transaction behind it. Read once; a workflow step
 * shows the row the server answers with, without reading the alert again.
 */
export function AlertDetail({ id }: { id: number }) {
  const [fetcher] = useState(() => once(() => amlaMonitoringApi.alert(id)));
  const resource = useApiResource(fetcher);
  const [latest, setLatest] = useState<AmlaAlertDetail | null>(null);
  return (
    <PageFill>
      <Link href="/amla/alerts" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to Alerts
      </Link>
      <DataState resource={resource} summary="This alert, its reason and its transactions." endpoints={["GET /amla/alerts/{id}"]}>
        {(loaded) => {
          const alert = latest ?? loaded;
          return <AlertBody alert={alert} onChanged={(row) => setLatest(amlaAlertWithRow(alert, row))} />;
        }}
      </DataState>
    </PageFill>
  );
}

function AlertBody({ alert, onChanged }: { alert: AmlaAlertDetail; onChanged: (row: AmlaAlertRow) => void }) {
  const { can } = usePermission();
  const row = amlaAlertRow(alert);
  const lines = amlaAlertLines(alert, amlaMonitoringAccess(can).customerLinks);
  const facts: [string, string][] = [
    ["Rule", `${row.rule} (${row.version})`],
    ["Branch", row.branch],
    ["Window", row.window],
    ["Amount", row.amount],
    ["Transactions", row.transactions],
    ["Detected", row.detected],
    ["Assigned to", alert.assigned_to?.name ?? "Not assigned"],
  ];

  return (
    <ScrollBox className="space-y-4 p-px">
      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {alert.reference}
          <Badge variant={row.tone}>{row.priority} priority</Badge>
          <Badge variant="outline">{row.status}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {lines.subjectHref ? (
            <Link href={lines.subjectHref} className="underline-offset-4 hover:underline">
              {row.subject}
            </Link>
          ) : (
            row.subject
          )}{" "}
          · {row.code}
          {row.history ? ` · ${row.history}` : ""}
        </p>
      </div>

      {lines.cleared && <p className="rounded-md border bg-muted/40 p-3 text-sm">{lines.cleared}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <AlertWorkflow alert={alert} onChanged={onChanged} />
        <AlertCaseLine alert={alert} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why it was raised</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{lines.reason}</p>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,10rem)_1fr]">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk indicators</CardTitle>
          </CardHeader>
          <CardContent>
            {lines.indicators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No indicators recorded.</p>
            ) : (
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
                {lines.indicators.map((indicator) => (
                  <div key={indicator.label} className="contents">
                    <dt className="text-muted-foreground">{indicator.label}</dt>
                    <dd>{indicator.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={alert.transactions} />
        </CardContent>
      </Card>

      <AlertHistoryCard alertId={alert.id} />
    </ScrollBox>
  );
}
