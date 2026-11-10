"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { formatDate, formatDateTime } from "@/lib/format";
import { savingsInterestService } from "@/services";
import type { InterestRun } from "@/types";
import { actorName } from "../../_lib/savings-rules";
import { RunLines } from "../_components/run-lines";
import { RunStatusBadge } from "../_components/run-status-badge";
import { RunTotals } from "../_components/run-totals";
import { RunActions } from "./_components/run-actions";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function RunDetail({ run, onChanged }: { run: InterestRun; onChanged: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Interest run</h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(run.period_start)} to {formatDate(run.period_end)}
          </p>
        </div>
        <RunActions run={run} onChanged={onChanged} />
      </div>
      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Product">{run.product?.name ?? "—"}</Detail>
            <Detail label="Branch">{run.branch?.name ?? "—"}</Detail>
            <Detail label="Created by">
              {actorName(run.created_by)}
              {run.created_at && (
                <span className="block text-xs font-normal text-muted-foreground">{formatDateTime(run.created_at)}</span>
              )}
            </Detail>
            <Detail label="Approved by">{run.approved_by ? run.approved_by.name : "—"}</Detail>
            <Detail label="Posted by">
              {run.posted_by ? run.posted_by.name : "—"}
              {run.posted_at && (
                <span className="block text-xs font-normal text-muted-foreground">{formatDateTime(run.posted_at)}</span>
              )}
            </Detail>
            {run.rejected_by && <Detail label="Rejected by">{run.rejected_by.name}</Detail>}
            {run.reject_reason && <Detail label="Reason for rejecting">{run.reject_reason}</Detail>}
            {run.reversed_by && <Detail label="Reversed by">{run.reversed_by.name}</Detail>}
            {run.reverse_reason && <Detail label="Reason for reversing">{run.reverse_reason}</Detail>}
          </dl>
        </CardContent>
      </Card>
      <RunTotals figures={run} />
      <RunLines lines={run.lines ?? []} />
    </div>
  );
}

function RunContent({ id }: { id: number }) {
  const fetcher = useCallback(() => savingsInterestService.get(id), [id]);
  const resource = useApiResource(fetcher);
  return (
    <div className="min-w-0 space-y-6">
      <Link
        href="/savings/interest"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Savings Interest
      </Link>
      <DataState
        resource={resource}
        endpoints={["GET /savings/interest-runs/{id}"]}
        summary="One interest run: its period, branch, per-account figures and approval state."
      >
        {(run) => <RunDetail run={run} onChanged={resource.refetch} />}
      </DataState>
    </div>
  );
}

export default function SavingsInterestRunPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteGuard permission="savings:view" pageName="Interest Run">
      <RunContent key={id} id={Number(id)} />
    </RouteGuard>
  );
}
