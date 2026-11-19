"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { amlaSubjectHref } from "@/lib/amla/cdd-access";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaCtrRow } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import type { AmlaCtrDetail } from "@/types/amla-monitoring";
import { TransactionsTable } from "./transactions-table";

/** One CTR candidate: why it is one, the settings version it was measured by, and its transaction. Read once. */
export function CtrDetail({ id }: { id: number }) {
  const [fetcher] = useState(() => once(() => amlaMonitoringApi.ctrCandidate(id)));
  const resource = useApiResource(fetcher);
  return (
    <PageFill>
      <Link href="/amla/ctr-candidates" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to CTR Candidates
      </Link>
      <DataState resource={resource} summary="This CTR candidate and its transaction." endpoints={["GET /amla/ctr-candidates/{id}"]}>
        {(candidate) => <CtrBody candidate={candidate} />}
      </DataState>
    </PageFill>
  );
}

function CtrBody({ candidate }: { candidate: AmlaCtrDetail }) {
  const { can } = usePermission();
  const row = amlaCtrRow(candidate);
  const { type, id } = candidate.subject;
  const subjectHref = amlaMonitoringAccess(can).customerLinks && type !== null && id !== null ? amlaSubjectHref(type, id) : null;
  const facts: [string, string][] = [
    ["Amount", row.amount],
    ["Threshold", row.threshold],
    ["Movement", row.movement],
    ["Date", row.date],
    ["Branch", row.branch],
  ];

  return (
    <ScrollBox className="space-y-4 p-px">
      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {candidate.reference}
          <Badge variant="outline">{row.status}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {subjectHref ? (
            <Link href={subjectHref} className="underline-offset-4 hover:underline">
              {row.subject}
            </Link>
          ) : (
            row.subject
          )}{" "}
          · {row.code}
        </p>
      </div>
      {row.notes.map((note) => (
        <p key={note} className="rounded-md border bg-muted/40 p-3 text-sm">
          {note}
        </p>
      ))}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why it is a candidate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{candidate.explanation}</p>
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
          <CardTitle className="text-base">Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable transactions={candidate.transaction ? [candidate.transaction] : []} />
        </CardContent>
      </Card>
    </ScrollBox>
  );
}
