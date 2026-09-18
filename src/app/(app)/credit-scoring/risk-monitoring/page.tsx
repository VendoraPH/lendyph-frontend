"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import { RiskLevelBadge } from "../_components/risk-level-badge";
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

export default function RiskMonitoringPage() {
  const router = useRouter();
  const fetcher = useCallback(() => creditScoringService.getRiskMonitoring(), []);
  const resource = useApiResource<RiskMonitoringData>(fetcher);

  return (
    <RouteGuard permission="credit_scoring:view" pageName="Risk Monitoring">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Risk Monitoring"
          description="Borrowers whose risk has changed and alerts that need review."
        />

        <DataState
          resource={resource}
          summary="Risk alerts and affected-borrower details will appear here once the backend is connected."
          endpoints={["GET /credit-scoring/risk-monitoring"]}
        >
          {(data) => (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Figure label="Total Borrowers" value={String(data.summary.total_borrowers)} />
                <Figure label="High Risk" value={String(data.summary.high_risk_count)} />
                <Figure label="Score Declines (30d)" value={String(data.summary.score_declines_30d)} />
                <Figure label="New Hard Flags (30d)" value={String(data.summary.new_hard_flags_30d)} />
              </div>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <p className="text-sm font-medium">Alerts</p>
                  {data.alerts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active alerts.</p>
                  )}
                  {data.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{alert.borrower_name}</span>
                          <Badge variant={SEVERITY_VARIANT[alert.severity]}>{alert.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.previous_score} → {alert.current_score} · {formatDateTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Past Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.affected_borrowers.map((row) => (
                      <TableRow
                        key={row.borrower_id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/credit-scoring/borrowers/${row.borrower_id}`)}
                      >
                        <TableCell className="font-medium">{row.borrower_name}</TableCell>
                        <TableCell>{row.branch_name}</TableCell>
                        <TableCell>{row.score}</TableCell>
                        <TableCell><RiskLevelBadge level={row.risk_level} /></TableCell>
                        <TableCell>{row.past_due ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DataState>
      </div>
    </RouteGuard>
  );
}
