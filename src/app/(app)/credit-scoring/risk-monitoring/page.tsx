"use client";

import { useCallback } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import { MemberCell } from "../_components/member-cell";
import { ScoreCells } from "../_components/score-cells";
import { ALERT_KIND_LABELS, ALERT_SEVERITY_LABELS } from "@/lib/credit-scoring/labels";
import { borrowerLabel } from "@/lib/credit-scoring/borrower-label";
import { countOrDash } from "@/lib/credit-scoring/score-state";
import { yesNoOrDash } from "@/lib/credit-scoring/loan-facts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { RiskMonitoringData } from "@/types/credit-scoring";

const SEVERITY_VARIANT = {
  info: "outline",
  warning: "secondary",
  critical: "destructive",
} as const;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RiskMonitoringContent() {
  const fetcher = useCallback(() => creditScoringService.getRiskMonitoring(), []);
  const resource = useApiResource<RiskMonitoringData>(fetcher);

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Risk Monitoring"
        description="Members whose risk has changed and alerts that need review."
      />

      <DataState
        resource={resource}
        summary="Risk alerts and the members who need review."
        endpoints={["GET /credit-scoring/risk-monitoring"]}
      >
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Figure label="Total Members" value={countOrDash(data.summary.total_borrowers)} />
              <Figure label="High Risk" value={countOrDash(data.summary.high_risk_count)} />
              <Figure label="Score Declines (30d)" value={countOrDash(data.summary.score_declines_30d)} />
              <Figure label="New Hard Flags (30d)" value={countOrDash(data.summary.new_hard_flags_30d)} />
            </div>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm font-medium">Alerts (last 30 days)</p>
                {data.alerts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active alerts.</p>
                )}
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/credit-scoring/borrowers/${alert.borrower_id}`} className="text-sm font-medium hover:underline">
                          {borrowerLabel(alert)}
                        </Link>
                        {alert.borrower_code && (
                          <span className="text-xs text-muted-foreground">{alert.borrower_code}</span>
                        )}
                        <Badge variant={SEVERITY_VARIANT[alert.severity]}>{ALERT_SEVERITY_LABELS[alert.severity]}</Badge>
                        <Badge variant="outline">{ALERT_KIND_LABELS[alert.kind]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.previous_score === null
                          ? `First score ${alert.current_score ?? "—"}`
                          : `${alert.previous_score} → ${alert.current_score ?? "—"}`}{" "}
                        · {formatDateTime(alert.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-2 rounded-lg border p-2">
              <p className="px-2 pt-2 text-sm font-medium">Members to review</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Past Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.affected_borrowers.map((row) => (
                    <TableRow key={row.borrower_id}>
                      <TableCell>
                        <MemberCell row={row} />
                      </TableCell>
                      <TableCell>{row.branch_name ?? "—"}</TableCell>
                      <ScoreCells row={row} />
                      <TableCell>{yesNoOrDash(row.past_due)}</TableCell>
                    </TableRow>
                  ))}
                  {data.affected_borrowers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        No members need review.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {data.affected_total > data.affected_borrowers.length && (
                <p className="px-2 pb-2 text-xs text-muted-foreground">
                  Showing {data.affected_borrowers.length} of {data.affected_total}, lowest score first.
                </p>
              )}
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}

export default function RiskMonitoringPage() {
  return (
    <RouteGuard permission="credit_scoring:view" pageName="Risk Monitoring">
      <RiskMonitoringContent />
    </RouteGuard>
  );
}
