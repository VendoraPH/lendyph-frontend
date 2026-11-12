"use client";

import { useCallback } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource, useIsClient } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "./_components/page-header";
import { FigureCard } from "./_components/figure-card";
import { BranchRiskTable } from "./_components/branch-risk-table";
import { RISK_LEVEL_LABELS } from "@/constants/risk-level";
import { formatDateTime } from "@/lib/format";
import { borrowerLabel } from "@/lib/credit-scoring/borrower-label";
import { averageScoreText, countOrDash, rowScoreView } from "@/lib/credit-scoring/score-state";
import { loanFigureReason, pesosOrDash } from "@/lib/credit-scoring/money";
import { riskLegend } from "@/lib/credit-scoring/risk-level";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CreditScoringDashboardSummary, RiskLevel } from "@/types/credit-scoring";
import type { LucideIcon } from "lucide-react";
import { Users, TrendingUp, ShieldAlert, History } from "lucide-react";

const CHART_HEX: Record<RiskLevel, string> = {
  very_low: "#10b981",
  low: "#22c55e",
  moderate: "#f59e0b",
  elevated: "#f97316",
  high: "#ef4444",
  very_high: "#b91c1c",
};

const SHORTCUTS: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Member Scores", href: "/credit-scoring/borrowers", icon: Users },
  { title: "Credit Assessment", href: "/credit-scoring/assessment", icon: TrendingUp },
  { title: "Risk Monitoring", href: "/credit-scoring/risk-monitoring", icon: ShieldAlert },
  { title: "Score History", href: "/credit-scoring/score-history", icon: History },
];

function DashboardBody({ data }: { data: CreditScoringDashboardSummary }) {
  const mounted = useIsClient();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FigureCard label="Scored Members" value={String(data.total_scored_borrowers)} />
        <FigureCard label="Average Score" value={averageScoreText(data.average_score)} />
        <FigureCard label="Insufficient Data" value={String(data.insufficient_data_count)} />
        <FigureCard
          label="High Risk Outstanding"
          value={pesosOrDash(data.high_risk_outstanding)}
          hiddenReason={loanFigureReason(data.high_risk_outstanding)}
        />
        <FigureCard label="Scores Due for Review" value={countOrDash(data.scores_due_for_review)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-2 text-sm font-medium">Risk Distribution</p>
          <div className="relative h-64">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.risk_distribution}
                    dataKey="count"
                    nameKey="risk_level"
                    innerRadius={60}
                    outerRadius={90}
                  >
                    {data.risk_distribution.map((entry) => (
                      <Cell key={entry.risk_level} fill={CHART_HEX[entry.risk_level]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, entry) => [
                      value,
                      RISK_LEVEL_LABELS[entry.payload.risk_level as keyof typeof RISK_LEVEL_LABELS],
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul aria-label="Risk distribution legend" className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {riskLegend(data.risk_distribution).map((item) => (
              <li key={item.level} className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_HEX[item.level] }}
                  />
                  {item.label}
                </span>
                <span className="font-medium tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <BranchRiskTable rows={data.branch_risk} />

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Recent Score Changes</p>
          <div className="space-y-2">
            {data.recent_score_changes.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent score changes.</p>
            )}
            {data.recent_score_changes.map((entry) => {
              const view = rowScoreView(entry);
              return (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/credit-scoring/borrowers/${entry.borrower_id}`}
                    className="font-medium hover:underline"
                  >
                    {borrowerLabel(entry)}
                  </Link>
                  <span className="text-muted-foreground">
                    {view.kind === "scored" ? `${view.score} · ${RISK_LEVEL_LABELS[view.riskLevel]}` : view.message}
                    {" · "}
                    {formatDateTime(entry.calculated_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreditScoringDashboardContent() {
  const fetcher = useCallback(() => creditScoringService.getDashboardSummary(), []);
  const resource = useApiResource<CreditScoringDashboardSummary>(fetcher);

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Credit Scoring"
        description="Portfolio-wide view of member credit scores and risk distribution."
      />

      <DataState
        resource={resource}
        summary="The credit scoring dashboard summarizes scored members, the average score, the risk distribution, risk by branch and the high risk members' outstanding balance."
        endpoints={["GET /credit-scoring/dashboard"]}
      >
        {(data) => <DashboardBody data={data} />}
      </DataState>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map((s) => (
          <Button key={s.href} variant="outline" className="h-auto justify-start gap-2 p-4" nativeButton={false} render={<Link href={s.href} />}>
            <s.icon className="h-4 w-4" />
            {s.title}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function CreditScoringDashboardPage() {
  return (
    <RouteGuard permission="credit_scoring:view" pageName="Credit Scoring">
      <CreditScoringDashboardContent />
    </RouteGuard>
  );
}
